import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepo: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
  ) {}

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlForClient(clientType: ClientType): number {
    return clientType === ClientType.DASHBOARD
      ? JWT_REFRESH_TTL_DASHBOARD
      : JWT_REFRESH_TTL_PWA;
  }

  get cookieName(): string {
    return REFRESH_TOKEN_COOKIE;
  }

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

  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.refreshTokenRepo.update({ userId }, { revokedAt: new Date() });
  }
}
