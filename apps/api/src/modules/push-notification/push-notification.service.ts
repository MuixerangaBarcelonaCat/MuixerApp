import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  AttendanceStatus,
  EventReferenceKind,
  EventType,
  NotificationLinkType,
  NotificationSource,
  NotificationTarget,
  NotificationTargetType,
} from '@muixer/shared';
import { getLocalToday } from '../../common/utils/date.util';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { User } from '../user/user.entity';
import { PushSenderService } from './push-sender.service';
import { PushSubscriptionService } from './push-subscription.service';
import { NotificationLogService } from './notification-log.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushRequestedEvent } from './events/push-requested.event';

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);

  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepo: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly subscriptionService: PushSubscriptionService,
    private readonly senderService: PushSenderService,
    private readonly eventEmitter: EventEmitter2,
    private readonly logService: NotificationLogService,
  ) {}

  async send(
    dto: SendNotificationDto,
    triggeredByUserId?: string,
  ): Promise<{ accepted: boolean; warning?: string }> {
    const eventId = dto.linkedEvent ? await this.resolveEventReference(dto.linkedEvent) : undefined;

    const userIds = await this.resolveTargetUserIds(dto, eventId);
    const resolvedTarget = this.buildResolvedTarget(dto.target, eventId);
    const url = this.resolveUrl(dto, eventId);

    await this.logService.record({
      title: dto.title,
      body: dto.body,
      url,
      target: resolvedTarget,
      recipientCount: userIds.length,
      source: NotificationSource.MANUAL,
      triggeredByUserId,
    });

    if (userIds.length === 0) {
      return { accepted: true, warning: 'Cap dispositiu subscrit per als destinataris seleccionats' };
    }

    const payload = {
      title: dto.title,
      body: dto.body,
      ...(url ? { url } : {}),
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

    // The sends still fan out one per device (that's the web-push protocol), but their
    // bookkeeping is collected and written as two UPDATEs instead of one per subscription.
    const usedIds: string[] = [];
    const goneIds: string[] = [];

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const result = await this.senderService.send(sub, event.payload);
        if (result.success) {
          usedIds.push(sub.id);
        } else if (result.gone) {
          goneIds.push(sub.id);
        } else if (result.statusCode === 429 || (result.statusCode ?? 0) >= 500) {
          this.logger.warn(`Push rate-limited or server error (${result.statusCode}), no retry`);
        }
      }),
    );

    await Promise.all([
      this.subscriptionService.markUsedMany(usedIds),
      this.subscriptionService.deactivateMany(goneIds),
    ]);
  }

  async dispatchToAllUsers(payload: { title: string; body: string; url?: string }): Promise<void> {
    const userIds = await this.subscriptionService.findUserIdsWithActiveSubscriptions();
    if (userIds.length === 0) return;

    this.eventEmitter.emit(
      'push.requested',
      new PushRequestedEvent(userIds, { ...payload, icon: '/icons/icon-192.png' }),
    );
  }

  private async resolveTargetUserIds(dto: SendNotificationDto, eventId?: string): Promise<string[]> {
    const { type } = dto.target;

    if (type === NotificationTargetType.ALL) {
      const users = await this.userRepo.find({ select: { id: true }, where: { isActive: true } });
      return users.map((u) => u.id);
    }

    if (type === NotificationTargetType.EVENT_ATTENDANCE) {
      if (!eventId) return [];
      const { attendanceFilter } = dto.target;
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

  /** Resolves the abstract event reference (a fixed id, or "the nearest upcoming X") to a concrete Event id. */
  private async resolveEventReference(eventRef: { kind: EventReferenceKind; eventId?: string }): Promise<string | undefined> {
    switch (eventRef.kind) {
      case EventReferenceKind.SPECIFIC:
        return eventRef.eventId;
      case EventReferenceKind.NEXT_ACTUACIO:
        return this.findNextEventId(EventType.ACTUACIO);
      case EventReferenceKind.NEXT_ASSAIG:
        return this.findNextEventId(EventType.ASSAIG);
      case EventReferenceKind.NEXT_ACTUACIO_OR_ASSAIG:
        return this.findNextEventId();
      case EventReferenceKind.TRIGGERING_EVENT:
        // Only meaningful from a BEFORE_EVENT scheduled dispatch (not built yet) — see docs plan phase 5.
        throw new BadRequestException(
          "TRIGGERING_EVENT només és vàlid en una notificació programada abans d'un esdeveniment",
        );
      default:
        return undefined;
    }
  }

  private async findNextEventId(eventType?: EventType): Promise<string | undefined> {
    const event = await this.eventRepo.findOne({
      where: {
        date: MoreThanOrEqual(getLocalToday() as unknown as Date),
        ...(eventType ? { eventType } : {}),
      },
      order: { date: 'ASC' },
    });
    return event?.id;
  }

  private resolveUrl(dto: SendNotificationDto, eventId: string | undefined): string | undefined {
    switch (dto.linkTo) {
      case NotificationLinkType.HOME:
        return '/home';
      case NotificationLinkType.EVENT:
        return eventId ? `/events/${eventId}` : undefined;
      case NotificationLinkType.CUSTOM:
        return dto.url;
      default:
        return undefined;
    }
  }

  /** Builds the flat, concrete target shape persisted to NotificationLog — the resolved eventId, not the abstract eventRef. */
  private buildResolvedTarget(
    target: SendNotificationDto['target'],
    eventId: string | undefined,
  ): NotificationTarget {
    if (target.type === NotificationTargetType.EVENT_ATTENDANCE) {
      return { type: target.type, eventId, attendanceFilter: target.attendanceFilter };
    }
    if (target.type === NotificationTargetType.PERSON) {
      return { type: target.type, personIds: target.personIds };
    }
    return { type: target.type };
  }
}
