import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuditAction, ClientType, LegalDocumentType, UserProfile, UserRole } from '@muixer/shared';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { LegalDocumentService } from '../legal/legal-document.service';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { PersonService } from '../person/person.service';
import { buildPasswordResetEmail } from '../mail/templates/password-reset.template';
import { TokenService } from './token.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { RegisterViaInviteDto } from './dto/register-via-invite.dto';
import { InviteRegistrationContextDto } from './dto/invite-registration-context.dto';
import { SetupUserDto } from './dto/setup-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { JWT_ACCESS_TTL, PASSWORD_RESET_TTL } from './constants/auth.constants';
import { hashToken } from '../../common/utils/hash-token.util';

const BCRYPT_ROUNDS = 12;
/** Prefix `PersonService.createProvisional` applies to provisional aliases; stripped on promotion. */
const PROVISIONAL_ALIAS_PREFIX = '~';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Hash bcrypt "senyal" amb el mateix cost (BCRYPT_ROUNDS) que els hashes reals.
   * Es compara contra aquest hash quan l'email no existeix, perquè `validateUser`
   * trigui el mateix temps tant si l'email té compte com si no (SEC-13, evita
   * enumeració d'usuaris per timing de login).
   */
  private readonly dummyPasswordHash = bcrypt.hashSync('sec-13-dummy-password', BCRYPT_ROUNDS);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
    private readonly legalService: LegalDocumentService,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly personService: PersonService,
  ) {}

  /** Comprova email i contrasenya via bcrypt. Retorna null si l'usuari no existeix, no està actiu o la contrasenya és incorrecta. */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['person'],
    });

    // Always run bcrypt.compare, even when the user doesn't exist, comparing
    // against a dummy hash of equal cost — otherwise a missing user short-circuits
    // before the (deliberately slow) bcrypt call, and the timing difference reveals
    // which emails have accounts.
    const valid = await bcrypt.compare(password, user?.passwordHash ?? this.dummyPasswordHash);

    if (!user || !user.isActive || !valid) return null;
    return user;
  }

  /** Genera un JWT d'accés amb payload {sub, email, role} i el TTL configurat a JWT_ACCESS_TTL. */
  private signAccessToken(user: User): string {
    return this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: JWT_ACCESS_TTL },
    );
  }

  /**
   * Transforma l'entitat User a la interfície pública UserProfile (sense passwordHash ni tokens
   * sensibles). Calcula `requiresPrivacyConsent` comparant la versió acceptada per l'usuari amb
   * el "watermark" de consentiment (la versió més alta que exigeix reacceptació) — no amb la
   * versió activa: una correcció (publicada amb `requiresConsent: false`) no mou el watermark.
   */
  private async toUserProfile(user: User): Promise<UserProfile> {
    const person = user.person as Person | null;
    const consentVersion = await this.legalService.getConsentVersion(
      LegalDocumentType.PRIVACY_POLICY,
    );
    const requiresPrivacyConsent =
      consentVersion != null &&
      (user.privacyPolicyVersion == null || user.privacyPolicyVersion < consentVersion);

    return {
      id: user.id,
      // Only active users ever reach toUserProfile (login/getMe/refresh all require isActive),
      // and email is only null pre-activation — safe to assert.
      email: user.email!,
      role: user.role,
      isActive: user.isActive,
      privacyPolicyAcceptedAt: user.privacyPolicyAcceptedAt
        ? user.privacyPolicyAcceptedAt.toISOString()
        : null,
      requiresPrivacyConsent,
      person: person
        ? {
            id: person.id,
            name: person.name,
            firstSurname: person.firstSurname,
            alias: person.alias,
            email: user.email,
          }
        : null,
    };
  }

  /**
   * Genera un access token i un refresh token per al client indicat. El refresh token es guarda
   * com a hash SHA-256 a la DB. Només ADMIN/TECHNICAL poden iniciar sessió des del dashboard;
   * qualsevol rol pot fer-ho des de la PWA.
   */
  async login(user: User, clientType: ClientType): Promise<{ response: AuthResponseDto; refreshToken: string }> {
    if (clientType === ClientType.DASHBOARD && ![UserRole.ADMIN, UserRole.TECHNICAL].includes(user.role)) {
      throw new UnauthorizedException('Només els usuaris tècnics o administradors poden accedir al panell de gestió');
    }

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.tokenService.createRefreshToken(user, clientType);
    return {
      response: { accessToken, user: await this.toUserProfile(user) },
      refreshToken,
    };
  }

  /**
   * Rota el refresh token (invalida l'antic, emet un de nou) i retorna un nou access token.
   * Llança 401 si el token és invàlid, revocat o caducat. Retorna el `clientType` emmagatzemat
   * al token: el rol de l'usuari i el `clientType` de la sessió són independents (p. ex. un
   * ADMIN pot tenir una sessió PWA), així que el TTL de la cookie s'ha de fixar a partir
   * d'aquest valor, mai del rol.
   */
  async refresh(
    rawRefreshToken: string,
  ): Promise<{ response: AuthResponseDto; newRefreshToken: string; clientType: ClientType }> {
    const { newRawToken, userId, clientType } = await this.tokenService.rotateRefreshToken(rawRefreshToken);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    const accessToken = this.signAccessToken(user);
    return {
      response: { accessToken, user: await this.toUserProfile(user) },
      newRefreshToken: newRawToken,
      clientType,
    };
  }

  /** Revoca el refresh token actual de la sessió. No afecta les altres sessions actives. */
  async logout(rawRefreshToken: string): Promise<void> {
    await this.tokenService.revokeToken(rawRefreshToken);
  }

  /** Revoca tots els refresh tokens de l'usuari (logout de tots els dispositius simultàniament). */
  async logoutAll(userId: string): Promise<void> {
    await this.tokenService.revokeAllUserTokens(userId);
  }

  /** Retorna el perfil públic de l'usuari autenticat a partir del `sub` del JWT. */
  async getMe(userId: string): Promise<UserProfile> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new UnauthorizedException();
    return this.toUserProfile(user);
  }

  /**
   * Registra que l'usuari accepta la política de privacitat: desa el timestamp i el watermark de
   * consentiment vigent (no la versió activa — vegeu `toUserProfile`), i escriu una entrada
   * d'auditoria CONSENT_ACCEPTED. Retorna el perfil actualitzat.
   */
  async acceptPrivacyPolicy(userId: string, ipAddress?: string | null): Promise<UserProfile> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new UnauthorizedException();

    const consentVersion = await this.legalService.getConsentVersion(
      LegalDocumentType.PRIVACY_POLICY,
    );
    const acceptedAt = new Date();

    await this.userRepo.update(user.id, {
      privacyPolicyAcceptedAt: acceptedAt,
      privacyPolicyVersion: consentVersion,
    });
    user.privacyPolicyAcceptedAt = acceptedAt;
    user.privacyPolicyVersion = consentVersion;

    await this.auditService.record({
      actorUserId: user.id,
      action: AuditAction.CONSENT_ACCEPTED,
      targetType: 'User',
      targetId: user.id,
      metadata: { privacyPolicyVersion: consentVersion },
      ipAddress,
    });

    return this.toUserProfile(user);
  }

  /**
   * Activa el compte d'un membre a partir del enllaç d'invitació: estableix email i contrasenya,
   * promociona la seva pròpia `Person` (surt de provisional, elimina el prefix `~` de l'àlies) i
   * registra l'acceptació de la política de privacitat — tot en una única transacció — i fa
   * auto-login un cop activat. Els dependents (xicalla) es completen a part, ja autenticat
   * (`MeService`), no aquí.
   */
  async registerViaInvite(
    dto: RegisterViaInviteDto,
  ): Promise<{ response: AuthResponseDto; refreshToken: string }> {
    const user = await this.userRepo.findOne({
      where: { inviteToken: hashToken(dto.token) },
      relations: ['person'],
    });

    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Invitació invàlida o caducada');
    }

    const existingWithEmail = await this.userRepo.findOne({ where: { email: dto.email } });
    if (existingWithEmail) {
      throw new ConflictException('Ja existeix un compte amb aquest email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const consentVersion = await this.legalService.getConsentVersion(
      LegalDocumentType.PRIVACY_POLICY,
    );
    const acceptedAt = new Date();

    const person = user.person as Person;
    const alias = person.alias.startsWith(PROVISIONAL_ALIAS_PREFIX)
      ? person.alias.slice(PROVISIONAL_ALIAS_PREFIX.length)
      : person.alias;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        email: dto.email,
        passwordHash,
        isActive: true,
        inviteToken: null,
        inviteExpiresAt: null,
        privacyPolicyAcceptedAt: acceptedAt,
        privacyPolicyVersion: consentVersion,
      });

      await this.personService.update(
        person.id,
        {
          name: dto.name,
          firstSurname: dto.firstSurname,
          secondSurname: dto.secondSurname,
          gender: dto.gender,
          phone: dto.phone,
          birthDate: dto.birthDate,
          isProvisional: false,
          alias,
        },
        manager,
      );
    });

    await this.auditService.record({
      actorUserId: user.id,
      action: AuditAction.CONSENT_ACCEPTED,
      targetType: 'User',
      targetId: user.id,
      metadata: { privacyPolicyVersion: consentVersion },
    });

    user.email = dto.email;
    user.passwordHash = passwordHash;
    user.isActive = true;
    user.inviteToken = null;
    user.inviteExpiresAt = null;
    user.privacyPolicyAcceptedAt = acceptedAt;
    user.privacyPolicyVersion = consentVersion;

    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.tokenService.createRefreshToken(user, ClientType.PWA);

    return {
      response: { accessToken, user: await this.toUserProfile(user) },
      refreshToken,
    };
  }

  /**
   * Retorna les dades per prellenar el formulari de registre (nom, cognoms, gènere, telèfon,
   * data de naixement ja introduïts per l'admin) i el text vigent de la política de privacitat,
   * a partir d'un token d'invitació vàlid. Només lectura — no consumeix el token.
   */
  async getInviteContext(token: string): Promise<InviteRegistrationContextDto> {
    const user = await this.userRepo.findOne({
      where: { inviteToken: hashToken(token) },
      relations: ['person'],
    });

    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Invitació invàlida o caducada');
    }

    const person = user.person as Person;
    const legalDocument = await this.legalService.findActive(LegalDocumentType.PRIVACY_POLICY);

    return {
      person: {
        name: person.name,
        firstSurname: person.firstSurname,
        secondSurname: person.secondSurname,
        gender: person.gender,
        phone: person.phone,
        birthDate: person.birthDate instanceof Date
          ? person.birthDate.toISOString().slice(0, 10)
          : (person.birthDate ?? null),
      },
      expiresAt: user.inviteExpiresAt.toISOString(),
      legalDocument: { content: legalDocument.content, version: legalDocument.version },
    };
  }

  /**
   * Crea el primer usuari ADMIN del sistema via `SETUP_TOKEN`. Bootstrap d'un sol ús:
   * es refusa tan bon punt existeix qualsevol usuari, abans de consultar res per email
   * (evita que l'endpoint es converteixi en un oracle d'existència de comptes un cop
   * ja hi ha usuaris — SEC-3).
   */
  async setupUser(dto: SetupUserDto): Promise<UserProfile> {
    const setupToken = this.configService.get<string>('SETUP_TOKEN');
    if (!setupToken) throw new ForbiddenException('Setup no disponible');

    const userCount = await this.userRepo.count();
    if (userCount > 0) {
      this.logger.warn(`Setup rebutjat: el sistema ja té usuaris (email=${dto.email})`);
      throw new ForbiddenException('Setup no disponible: el sistema ja està inicialitzat');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const personId = dto.personId;

    if (personId) {
      const person = await this.personRepo.findOne({ where: { id: personId } });
      if (!person) {
        throw new NotFoundException(`Person with ID ${personId} not found`);
      }
    }

    const reloaded = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: dto.email,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      });
      const saved = await manager.save(User, user);

      if (personId) {
        await manager.update(User, saved.id, { person: { id: personId } });
      }

      return manager.findOne(User, {
        where: { id: saved.id },
        relations: ['person'],
      });
    });

    if (reloaded) {
      this.logger.log(`Usuari ADMIN de bootstrap creat (email=${dto.email})`);
      return this.toUserProfile(reloaded);
    } else {
      throw new InternalServerErrorException('No s\'ha pogut crear l\'usuari');
    }
  }

  /**
   * Genera un token de recuperació de contrasenya i l'envia per correu, si l'email
   * correspon a un usuari actiu. No informa mai si l'email existeix o no (evita
   * enumeració de comptes) — sempre completa sense llançar, perquè el controller
   * pugui respondre igual independentment del resultat.
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !user.isActive) return;

    const rawToken = crypto.randomBytes(16).toString('hex');
    const resetExpiresAt = new Date(Date.now() + PASSWORD_RESET_TTL * 1000);

    await this.userRepo.update(user.id, {
      resetToken: hashToken(rawToken),
      resetExpiresAt,
    });

    const protocol = this.configService.get<string>('NODE_ENV') === 'production' ? 'https' : 'http';
    const siteAddress = this.configService.get<string>('SITE_ADDRESS');
    const resetUrl = `${protocol}://${siteAddress}/reset-password?token=${rawToken}`;

    try {
      // user.isActive was checked above — only active users have a real (non-null) email.
      await this.mailService.send({ to: user.email!, ...buildPasswordResetEmail(resetUrl) });
    } catch (err) {
      this.logger.warn(`No s'ha pogut enviar el correu de recuperació de contrasenya (userId=${user.id})`, err instanceof Error ? err.stack : err);
    }
  }

  /**
   * Estableix una nova contrasenya a partir d'un token de recuperació vàlid i
   * revoca totes les sessions actives de l'usuari (un canvi de contrasenya ha
   * de tancar qualsevol sessió existent, com `logoutAll`).
   */
  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { resetToken: hashToken(dto.token) } });

    if (!user || !user.resetExpiresAt || user.resetExpiresAt < new Date()) {
      throw new UnauthorizedException('Token de recuperació invàlid o caducat');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, {
      passwordHash,
      resetToken: null,
      resetExpiresAt: null,
    });

    await this.tokenService.revokeAllUserTokens(user.id);
  }

  /**
   * Canvia la contrasenya de l'usuari autenticat, verificant la contrasenya actual, i revoca
   * totes les sessions (mateix comportament que `resetPassword` — un canvi de contrasenya ha
   * de tancar qualsevol sessió existent).
   */
  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contrasenya actual incorrecta');

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, { passwordHash });
    await this.tokenService.revokeAllUserTokens(user.id);
  }

  /**
   * Canvia el correu electrònic de l'usuari autenticat de forma immediata, verificant la
   * contrasenya actual per confirmar la identitat (sense doble opt-in per correu).
   */
  async changeEmail(userId: string, dto: ChangeEmailDto): Promise<UserProfile> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['person'] });
    if (!user) throw new UnauthorizedException();

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contrasenya actual incorrecta');

    if (dto.newEmail !== user.email) {
      const existing = await this.userRepo.findOne({ where: { email: dto.newEmail } });
      if (existing) throw new ConflictException('Ja existeix un compte amb aquest correu electrònic');
    }

    await this.userRepo.update(user.id, { email: dto.newEmail });
    user.email = dto.newEmail;

    return this.toUserProfile(user);
  }
}
