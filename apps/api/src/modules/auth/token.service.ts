import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { And, LessThan, Not, IsNull, Repository } from 'typeorm';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { ClientType, UserSession } from '@muixer/shared';
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
   * Crea un nou refresh token opac (256 bits aleatoris), el guarda com a hash SHA-256 a la DB
   * i retorna el token en clar. La validesa la decideix sempre la fila de la DB
   * (expiresAt/revokedAt/usedAt). Si s'especifica `family`, el token pertany a una família de
   * rotació existent; sinó en crea una de nova.
   */
  async createRefreshToken(
    user: User,
    clientType: ClientType,
    family?: string,
    userAgent?: string | null,
    repo: Repository<RefreshToken> = this.refreshTokenRepo,
  ): Promise<string> {
    const ttl = this.ttlForClient(clientType);
    const tokenFamily = family ?? randomUUID();

    const rawToken = randomBytes(32).toString('hex');

    const expiresAt = new Date(Date.now() + ttl * 1000);

    const entity = repo.create({
      userId: user.id,
      tokenHash: this.hash(rawToken),
      family: tokenFamily,
      clientType,
      userAgent: userAgent ? userAgent.slice(0, 255) : null,
      expiresAt,
      usedAt: null,
      revokedAt: null,
    });
    await repo.save(entity);

    return rawToken;
  }

  /**
   * Runs `fn` in a transaction holding a per-user advisory lock, so a rotation and a revoke of the
   * same user never interleave: without it, a refresh that read its token before an admin revoke
   * could insert a fresh, non-revoked token into the revoked family after it.
   * ponytail: serializes every refresh/revoke of one user; per-family keys if that ever contends.
   */
  private withUserLock<T>(userId: string, fn: (repo: Repository<RefreshToken>) => Promise<T>): Promise<T> {
    return this.refreshTokenRepo.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [userId]);
      return fn(manager.getRepository(RefreshToken));
    });
  }

  /**
   * Valida el token, el marca com a usat de forma atòmica i en genera un de nou dins de la
   * mateixa família. La marca com a usat és un únic UPDATE condicionat a `usedAt IS NULL`:
   * si afecta 0 files, algú (una reutilització, o una petició concurrent que ha guanyat la
   * cursa pel mateix token) ja l'ha reclamat abans — es tracta com a reutilització detectada
   * i es revoca tota la família. Un `findOne` seguit d'un `update` separats permetria que dues
   * peticions concurrents amb el mateix token passessin totes dues la comprovació (SEC-5).
   */
  async rotateRefreshToken(
    rawToken: string,
    userAgent?: string | null,
  ): Promise<{ newRawToken: string; userId: string; clientType: ClientType }> {
    const tokenHash = this.hash(rawToken);
    const stored = await this.refreshTokenRepo.findOne({ where: { tokenHash } });

    if (!stored) throw new UnauthorizedException('Token invàlid');
    if (stored.revokedAt !== null) throw new UnauthorizedException('Token revocat');
    if (stored.expiresAt < new Date()) throw new UnauthorizedException('Token caducat');

    // Under the lock, `revokedAt IS NULL` also catches a revoke that landed after the read above.
    const newRawToken = await this.withUserLock(stored.userId, async (repo) => {
      const claim = await repo.update(
        { id: stored.id, usedAt: IsNull(), revokedAt: IsNull() },
        { usedAt: new Date() },
      );
      if (claim.affected === 0) return null;
      const userRef = { id: stored.userId } as User;
      return this.createRefreshToken(userRef, stored.clientType, stored.family, userAgent ?? stored.userAgent, repo);
    });

    if (newRawToken === null) {
      // Reuse detected (or lost the race, or revoked meanwhile) — revoke entire family
      await this.refreshTokenRepo.update(
        { family: stored.family },
        { revokedAt: new Date() },
      );
      throw new UnauthorizedException('Token reutilitzat detectat');
    }

    return { newRawToken, userId: stored.userId, clientType: stored.clientType };
  }

  /** Revoca un token específic marcant-lo amb `revokedAt`. Usat en logout normal (sessió actual). */
  async revokeToken(rawToken: string): Promise<void> {
    const tokenHash = this.hash(rawToken);
    await this.refreshTokenRepo.update({ tokenHash }, { revokedAt: new Date() });
  }

  /** Revoca tots els tokens actius d'un usuari. Usat en logout-all (tots els dispositius). */
  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.withUserLock(userId, (repo) => repo.update({ userId }, { revokedAt: new Date() }));
  }

  /** Revoca una sessió (família) d'un usuari. Retorna les files afectades (0 si la família no és seua). */
  async revokeFamily(userId: string, family: string): Promise<number> {
    const result = await this.withUserLock(userId, (repo) =>
      repo.update({ userId, family, revokedAt: IsNull() }, { revokedAt: new Date() }),
    );
    return result.affected ?? 0;
  }

  /**
   * Sessions obertes d'un usuari: famílies amb alguna fila activa (no revocada, no usada, no
   * caducada). `startedAt`/`lastRefreshAt` = primera/última fila, `userAgent` el de la més nova.
   */
  async listActiveSessions(userId: string): Promise<UserSession[]> {
    const rows = await this.refreshTokenRepo.find({
      where: { userId, revokedAt: IsNull() },
      order: { createdAt: 'DESC' },
    });
    const now = new Date();
    const byFamily = new Map<string, RefreshToken[]>();
    for (const row of rows) byFamily.set(row.family, [...(byFamily.get(row.family) ?? []), row]);

    return [...byFamily.entries()]
      .filter(([, fam]) => fam.some((r) => r.usedAt === null && r.expiresAt > now))
      .map(([family, fam]) => ({
        family,
        clientType: fam[0].clientType,
        userAgent: fam[0].userAgent,
        startedAt: fam[fam.length - 1].createdAt.toISOString(),
        lastRefreshAt: fam[0].createdAt.toISOString(),
        expiresAt: new Date(Math.max(...fam.map((r) => r.expiresAt.getTime()))).toISOString(),
      }))
      .sort((a, b) => b.lastRefreshAt.localeCompare(a.lastRefreshAt));
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
      revokedAt: And(Not(IsNull()), LessThan(thirtyDaysAgo)),
    });

    const total = (expiredResult.affected ?? 0) + (revokedResult.affected ?? 0);
    if (total > 0) {
      this.logger.log(`Cleanup: ${total} refresh tokens obsolets eliminats`);
    }
  }
}
