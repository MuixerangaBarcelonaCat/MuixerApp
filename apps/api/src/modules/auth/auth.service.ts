import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    private readonly jwtService: JwtService,
    private readonly tokenService: TokenService,
  ) {}

  /** Comprova email i contrasenya via bcrypt. Retorna null si l'usuari no existeix, no està actiu o la contrasenya és incorrecta. */
  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['person'],
    });
    if (!user || !user.isActive) return null;
    const valid = await bcrypt.compare(password, user.passwordHash);
    return valid ? user : null;
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

  /** Genera un access token i un refresh token per al client indicat. El refresh token es guarda com a hash SHA-256 a la DB. */
  async login(user: User, clientType: ClientType): Promise<{ response: AuthResponseDto; refreshToken: string }> {
    const accessToken = this.signAccessToken(user);
    const refreshToken = await this.tokenService.createRefreshToken(user, clientType);
    return {
      response: { accessToken, user: this.toUserProfile(user) },
      refreshToken,
    };
  }

  /** Rota el refresh token (invalida l'antic, emet un de nou) i retorna un nou access token. Llança 401 si el token és invàlid, revocat o caducat. */
  async refresh(rawRefreshToken: string): Promise<{ response: AuthResponseDto; newRefreshToken: string }> {
    const { newRawToken, userId } = await this.tokenService.rotateRefreshToken(rawRefreshToken);

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user || !user.isActive) throw new UnauthorizedException();

    const accessToken = this.signAccessToken(user);
    return {
      response: { accessToken, user: this.toUserProfile(user) },
      newRefreshToken: newRawToken,
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
      where: { inviteToken: dto.token },
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

  /** Crea el primer usuari TECHNICAL via `SETUP_TOKEN`. Si l'email ja existeix, retorna el perfil existent sense crear-ne un de nou (idempotent). */
  async setupUser(dto: SetupUserDto): Promise<UserProfile> {
    const setupToken = process.env['SETUP_TOKEN'];
    if (!setupToken) throw new ForbiddenException('Setup no disponible');

    const existing = await this.userRepo.findOne({
      where: { email: dto.email },
      relations: ['person'],
    });
    if (existing) return this.toUserProfile(existing);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const user = this.userRepo.create({
      email: dto.email,
      passwordHash,
      role: dto.role ?? UserRole.TECHNICAL,
      isActive: true,
    });
    const saved = await this.userRepo.save(user);

    let personId = dto.personId;

    if (personId) {
      await this.userRepo.query(
        `UPDATE users SET person_id = $1 WHERE id = $2`,
        [personId, saved.id],
      );
    }

    const reloaded = await this.userRepo.findOne({
      where: { id: saved.id },
      relations: ['person'],
    });
    return this.toUserProfile(reloaded!);
  }
}
