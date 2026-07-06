import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ClientType, UserProfile, UserRole } from '@muixer/shared';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { TokenService } from './token.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { SetupUserDto } from './dto/setup-user.dto';
import { JWT_ACCESS_TTL } from './constants/auth.constants';
import { hashToken } from '../../common/utils/hash-token.util';

const BCRYPT_ROUNDS = 12;

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

  /** Transforma l'entitat User a la interfície pública UserProfile (sense passwordHash ni tokens sensibles). */
  private toUserProfile(user: User): UserProfile {
    const person = user.person as Person | null;
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      person: person
        ? {
            id: person.id,
            name: person.name,
            firstSurname: person.firstSurname,
            alias: person.alias,
            email: person.managedBy?.email ?? null,
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
      response: { accessToken, user: this.toUserProfile(user) },
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
      response: { accessToken, user: this.toUserProfile(user) },
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

  /** Activa el compte d'un membre a partir del token d'invitació. Valida que el token no hagi caducat i fa auto-login un cop activat. */
  async acceptInvite(dto: AcceptInviteDto): Promise<{ response: AuthResponseDto; refreshToken: string }> {
    const user = await this.userRepo.findOne({
      where: { inviteToken: hashToken(dto.token) },
      relations: ['person'],
    });

    if (!user || !user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedException('Invitació invàlida o caducada');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    await this.userRepo.update(user.id, {
      passwordHash,
      isActive: true,
      inviteToken: null,
      inviteExpiresAt: null,
    });

    user.passwordHash = passwordHash;
    user.isActive = true;
    user.inviteToken = null;
    user.inviteExpiresAt = null;

    const clientType = user.role === UserRole.MEMBER ? ClientType.PWA : ClientType.DASHBOARD;
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.tokenService.createRefreshToken(user, clientType);

    return {
      response: { accessToken, user: this.toUserProfile(user) },
      refreshToken,
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

    const reloaded = await this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email: dto.email,
        passwordHash,
        role: UserRole.ADMIN,
        isActive: true,
      });
      const saved = await manager.save(User, user);

      if (personId) {
        await manager.query(
          `UPDATE users SET person_id = $1 WHERE id = $2`,
          [personId, saved.id],
        );
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
}
