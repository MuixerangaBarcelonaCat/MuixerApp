import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PushSubscriptionStatus, DeviceSummary } from '@muixer/shared';
import { User } from '../user/user.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { RegisterSubscriptionDto } from './dto/register-subscription.dto';
import { PushSubscriptionData } from './push-provider.interface';

const MAX_ACTIVE_SUBSCRIPTIONS_PER_USER = 10;

@Injectable()
export class PushSubscriptionService {
  private readonly logger = new Logger(PushSubscriptionService.name);

  constructor(
    @InjectRepository(PushSubscription)
    private readonly repo: Repository<PushSubscription>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
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

  async deactivate(subscriptionId: string): Promise<void> {
    await this.repo.update(subscriptionId, { isActive: false });
    this.logger.warn(`Subscription deactivated (410 Gone): ${subscriptionId}`);
  }

  async markUsed(subscriptionId: string): Promise<void> {
    await this.repo.update(subscriptionId, { lastUsedAt: new Date() });
  }

  async getSummary(): Promise<DeviceSummary[]> {
    const rows = await this.repo
      .createQueryBuilder('sub')
      .innerJoin('sub.user', 'user')
      .innerJoin('user.person', 'person')
      .select('person.id', 'personId')
      .addSelect('person.name', 'name')
      .addSelect('person.firstSurname', 'firstSurname')
      .addSelect('COUNT(sub.id)', 'activeDevices')
      .addSelect('MAX(sub.lastUsedAt)', 'lastPushAt')
      .where('sub.isActive = true')
      .groupBy('person.id, person.name, person.firstSurname')
      .orderBy('person.firstSurname', 'ASC')
      .addOrderBy('person.name', 'ASC')
      .getRawMany<{ personId: string; name: string; firstSurname: string; activeDevices: string; lastPushAt: string | null }>();

    return rows.map((r) => ({
      person: { id: r.personId, firstName: r.name, lastName: r.firstSurname },
      activeDevices: parseInt(r.activeDevices, 10),
      lastPushAt: r.lastPushAt,
    }));
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
