import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Repository } from 'typeorm';
import { AttendanceStatus, NotificationTargetType } from '@muixer/shared';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { PushSenderService } from './push-sender.service';
import { PushSubscriptionService } from './push-subscription.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushRequestedEvent } from './events/push-requested.event';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly subscriptionService: PushSubscriptionService,
    private readonly senderService: PushSenderService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async send(dto: SendNotificationDto): Promise<{ accepted: boolean; warning?: string }> {
    const userIds = await this.resolveTargetUserIds(dto);
    if (userIds.length === 0) {
      return { accepted: true, warning: 'Cap dispositiu subscrit per als destinataris seleccionats' };
    }

    const payload = {
      title: dto.title,
      body: dto.body,
      ...(dto.url ? { url: dto.url } : {}),
      icon: '/icons/icon-192.png',
    };

    this.eventEmitter.emit('push.requested', new PushRequestedEvent(userIds, payload));
    return { accepted: true };
  }

  @OnEvent('push.requested', { async: true })
  async handlePushRequested(event: PushRequestedEvent): Promise<void> {
    const subscriptions = await this.subscriptionService.findActiveByUserIds(event.userIds);

    if (subscriptions.length === 0) {
      this.logger.log('No active subscriptions found for push event');
      return;
    }

    this.logger.log(`Dispatching push to ${subscriptions.length} subscription(s)`);

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const result = await this.senderService.send(sub, event.payload);
        if (result.success) {
          await this.subscriptionService.markUsed(sub.id);
        } else if (result.gone) {
          await this.subscriptionService.deactivate(sub.id);
        } else if (result.statusCode === 429 || (result.statusCode ?? 0) >= 500) {
          this.logger.warn(`Push rate-limited or server error (${result.statusCode}), no retry`);
        }
      }),
    );
  }

  async dispatchToAllUsers(payload: { title: string; body: string; url?: string }): Promise<void> {
    const userIds = await this.subscriptionService.findUserIdsWithActiveSubscriptions();
    if (userIds.length === 0) return;

    this.eventEmitter.emit(
      'push.requested',
      new PushRequestedEvent(userIds, { ...payload, icon: '/icons/icon-192.png' }),
    );
  }

  private async resolveTargetUserIds(dto: SendNotificationDto): Promise<string[]> {
    const { type } = dto.target;

    if (type === NotificationTargetType.ALL) {
      const users = await this.userRepo.find({ select: { id: true }, where: { isActive: true } });
      return users.map((u) => u.id);
    }

    if (type === NotificationTargetType.EVENT_ATTENDANCE) {
      const { eventId, attendanceFilter } = dto.target;
      const qb = this.attendanceRepo
        .createQueryBuilder('a')
        .innerJoin('a.person', 'p')
        .innerJoin('p.user', 'u')
        .innerJoin('a.event', 'e')
        .select('u.id', 'userId')
        .where('e.id = :eventId', { eventId })
        .andWhere('u.isActive = true');

      if (attendanceFilter) {
        qb.andWhere('a.status = :status', { status: attendanceFilter as AttendanceStatus });
      }

      const rows = await qb.getRawMany<{ userId: string }>();
      return rows.map((r) => r.userId);
    }

    if (type === NotificationTargetType.PERSON) {
      const { personIds } = dto.target;
      if (!personIds?.length) return [];
      const users = await this.userRepo
        .createQueryBuilder('u')
        .innerJoin('u.person', 'p')
        .select('u.id', 'userId')
        .where('p.id IN (:...personIds)', { personIds })
        .andWhere('u.isActive = true')
        .getRawMany<{ userId: string }>();
      return users.map((r) => r.userId);
    }

    return [];
  }
}
