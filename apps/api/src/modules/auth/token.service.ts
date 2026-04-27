import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Not, IsNull, Repository } from 'typeorm';
import { createHash, randomUUID } from 'crypto';
import { ClientType } from '@muixer/shared';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../user/user.entity';
import {
  JWT_REFRESH_TTL_DASHBOARD,
  JWT_REFRESH_TTL_PWA,
  REFRESH_TOKEN_COOKIE,
} from './constants/auth.constants';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  /** Calcula el hash SHA-256 d'un token en clar per emmagatzemar-lo de forma segura a la DB. */
  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Retorna el TTL en segons per al tipus de client (Dashboard: 8h, PWA: 7 dies). */
  private ttlForClient(clientType: ClientType): number {
    return clientType === ClientType.DASHBOARD
      ? JWT_REFRESH_TTL_DASHBOARD
      : JWT_REFRESH_TTL_PWA;
  }

  get cookieName(): string {
    return REFRESH_TOKEN_COOKIE;
  }

  /**
   * Crea un nou refresh token JWT, el guarda com a hash SHA-256 a la DB i retorna el token en clar.
   * Si s'especifica `family`, el token pertany a una família de rotació existent; sinó en crea una de nova.
   */
  async createRefreshToken(
    user: User,
    clientType: ClientType,
    family?: string,
  ): Promise<string> {
    const ttl = this.ttlForClient(clientType);
    const tokenFamily = family ?? randomUUID();

    const rawToken: string = await this.jwtService.signAsync(
      { sub: user.id, family: tokenFamily, clientType },
      {
        secret: process.env['JWT_REFRESH_SECRET'] ?? 'change-me-refresh',
        expiresIn: ttl,
      },
    );

    const expiresAt = new Date(Date.now() + ttl * 1000);

    const entity = this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: this.hash(rawToken),
      family: tokenFamily,
      clientType,
      expiresAt,
      usedAt: null,
      revokedAt: null,
    });
    await this.refreshTokenRepo.save(entity);

    return rawToken;
  }

  /**
   * Valida el token, el marca com a usat i en genera un de nou dins de la mateixa família.
   * Si el token ja havia estat usat anteriorment (reutilització detectada), revoca tota la família per prevenció.
   */
  async rotateRefreshToken(rawToken: string): Promise<{ newRawToken: string; userId: string }> {
    const tokenHash = this.hash(rawToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('Token invàlid');

    if (stored.usedAt !== null) {
      // Reuse detected — revoke entire family
      await this.refreshTokenRepo.update(
        { family: stored.family },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Token reutilitzat detectat');
    }

    if (stored.revokedAt !== null) throw new UnauthorizedException('Token revocat');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Token caducat');

    // Mark current as used
    await this.refreshTokenRepo.update(stored.id, { usedAt: new Date() });

    // Load the user entity for signing
    const userRef = { id: stored.userId } as User;
    const newRawToken = await this.createRefreshToken(userRef, stored.clientType, stored.family);

    return { newRawToken, userId: stored.userId };
  }

  /** Revoca un token específic marcant-lo amb `revokedAt`. Usat en logout normal (sessió actual). */
  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  /** Revoca tots els tokens actius d'un usuari. Usat en logout-all (tots els dispositius). */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId }, { revokedAt: new Date() });
  }

  /**
   * Elimina refresh tokens obsolets de la DB cada dia a les 03:00.
   * Un token es considera obsolet si ha caducat o ha estat revocat fa més de 30 dies.
   * Evita l'acumulació indefinida de files a la taula `refresh_tokens`.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens(): Promise<void> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const expiredResult = await this.refreshTokenRepo.delete({
      expiresAt: LessThan(thirtyDaysAgo),
    });

    const revokedResult = await this.refreshTokenRepo.delete({
      revokedAt: Not(IsNull()),
      expiresAt: LessThan(thirtyDaysAgo),
    });

    const total = (expiredResult.affected ?? 0) + (revokedResult.affected ?? 0);
    if (total > 0) {
      this.logger.log(`Cleanup: ${total} refresh tokens obsolets eliminats`);
    }
  }
}
