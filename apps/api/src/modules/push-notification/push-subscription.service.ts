import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushSubscriptionStatus, UserPushDevice } from '@muixer/shared';
import { User } from '../user/user.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { PushSubscriptionData } from './push-provider.interface';
import { PushSenderService } from './push-sender.service';

const MAX_ACTIVE_SUBSCRIPTIONS_PER_USER = 10;

@Injectable()
export class PushSubscriptionService {
  private readonly logger = new Logger(PushSubscriptionService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly sender: PushSenderService,
  ) {}

  async register(userId: string, dto: RegisterSubscriptionDto): Promise<PushSubscription> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['person'] });
    if (!user?.person) {
      throw new ForbiddenException('Cal tenir un membre associat per subscriure\'s a les notificacions');
    }

    if (!dto.isEndpointAllowed()) {
      throw new BadRequestException('Endpoint de push no permès');
    }

    const existing = await this.repo.findOne({ where: { endpoint: dto.endpoint } });

    if (existing) {
      // Upsert: if same user re-subscribes (e.g. keys rotated), update and re-enable.
      if (existing.userId !== userId) {
        // Different user owns this endpoint — shouldn't happen in practice, but protect it.
        throw new BadRequestException('Endpoint ja registrat per un altre usuari');
      }
      // Inactive = the member unsubscribed, an admin removed it, or the push service said 410.
      // None of those should come back on their own: only an explicit opt-in re-enables it.
      if (!existing.isActive && dto.silent) {
        return existing;
      }
      // Re-enabling a previously deactivated endpoint still counts against the device cap.
      if (!existing.isActive) {
        await this.assertUnderDeviceCap(userId);
      }
      await this.repo.update(existing.id, {
        keys: dto.keys,
        userAgent: dto.userAgent ?? null,
        isActive: true,
      });
      return this.repo.findOneOrFail({ where: { id: existing.id } });
    }

    await this.assertUnderDeviceCap(userId);

    const subscription = this.repo.create({
      userId,
      endpoint: dto.endpoint,
      keys: dto.keys,
      userAgent: dto.userAgent ?? null,
      isActive: true,
    });
    return this.repo.save(subscription);
  }

  /** Enforce max active subscriptions per user. */
  private async assertUnderDeviceCap(userId: string): Promise<void> {
    const activeCount = await this.repo.count({ where: { userId, isActive: true } });
    if (activeCount >= MAX_ACTIVE_SUBSCRIPTIONS_PER_USER) {
      throw new BadRequestException(`Màxim ${MAX_ACTIVE_SUBSCRIPTIONS_PER_USER} dispositius per usuari`);
    }
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    const subscription = await this.repo.findOne({ where: { endpoint, userId } });
    if (!subscription) {
      throw new NotFoundException('Subscripció no trobada');
    }
    await this.repo.update(subscription.id, { isActive: false });
  }

  /** Active devices of a user for the admin devices modal. Never exposes endpoint or keys. */
  async listActiveForUser(userId: string): Promise<UserPushDevice[]> {
    const rows = await this.repo.find({ where: { userId, isActive: true }, order: { createdAt: 'DESC' } });
    return rows.map((r) => ({
      id: r.id,
      userAgent: r.userAgent,
      createdAt: r.createdAt.toISOString(),
      lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
    }));
  }

  /** Deactivates one subscription, scoped to its owner. False when it is not the user's (or already off). */
  async deactivateForUser(userId: string, id: string): Promise<boolean> {
    const result = await this.repo.update({ id, userId, isActive: true }, { isActive: false });
    return (result.affected ?? 0) > 0;
  }

  /** Sends a test push to one of the user's subscriptions. Null when it is not the user's (or inactive). */
  async sendTest(userId: string, id: string): Promise<{ success: boolean; gone: boolean } | null> {
    const sub = await this.repo.findOne({ where: { id, userId, isActive: true } });
    if (!sub) return null;
    const result = await this.sender.send(sub as unknown as PushSubscriptionData, {
      title: 'Notificació de prova',
      body: 'Este dispositiu rep les notificacions de MuixerApp.',
      icon: '/icons/icon-192.png',
    });
    const gone = result.gone === true;
    if (result.success) await this.markUsedMany([id]);
    else if (gone) await this.deactivateMany([id]);
    return { success: result.success, gone };
  }

  async getStatus(userId: string): Promise<PushSubscriptionStatus> {
    const deviceCount = await this.repo.count({ where: { userId, isActive: true } });
    return { isSubscribed: deviceCount > 0, deviceCount };
  }

  async findActiveByUserIds(userIds: string[]): Promise<PushSubscriptionData[]> {
    if (userIds.length === 0) return [];
    return this.repo.find({
      select: { id: true, userId: true, endpoint: true, keys: true },
      where: { userId: In(userIds), isActive: true },
    }) as unknown as PushSubscriptionData[];
  }

  /** Distinct user ids that currently have at least one active subscription. */
  async findUserIdsWithActiveSubscriptions(): Promise<string[]> {
    const rows = await this.repo
      .createQueryBuilder('sub')
      .select('DISTINCT sub.user_id', 'userId')
      .where('sub.isActive = true')
      .getRawMany<{ userId: string }>();
    return rows.map((r) => r.userId);
  }

  /**
   * Batch variants of the per-subscription updates. One push to the whole colla resolves to
   * hundreds of subscriptions, and updating them one row at a time meant one UPDATE round trip
   * per device; both callers already hold the full id list once the sends have settled.
   */
  async deactivateMany(subscriptionIds: string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    await this.repo.update({ id: In(subscriptionIds) }, { isActive: false });
    this.logger.warn(`Subscriptions deactivated (410 Gone): ${subscriptionIds.join(', ')}`);
  }

  async markUsedMany(subscriptionIds: string[]): Promise<void> {
    if (subscriptionIds.length === 0) return;
    await this.repo.update({ id: In(subscriptionIds) }, { lastUsedAt: new Date() });
  }

  /** Called by cron: remove stale inactive/never-used subscriptions. */
  async cleanupStale(): Promise<{ inactive: number; neverUsed: number }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const inactiveResult = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"isActive" = false AND "updatedAt" < :cutoff', { cutoff: thirtyDaysAgo })
      .execute();

    const neverUsedResult = await this.repo
      .createQueryBuilder()
      .delete()
      .where('"lastUsedAt" IS NULL AND "createdAt" < :cutoff', { cutoff: ninetyDaysAgo })
      .execute();

    return { inactive: inactiveResult.affected ?? 0, neverUsed: neverUsedResult.affected ?? 0 };
  }
}
