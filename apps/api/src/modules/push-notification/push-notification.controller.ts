import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DeviceSummary, JwtPayload, PaginatedResponse, UserRole } from '@muixer/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';
import { NotificationLogService } from './notification-log.service';
import { NotificationLog } from './entities/notification-log.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { NotificationLogFilterDto } from './dto/notification-log-filter.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class PushNotificationController {
  constructor(
    private readonly notificationService: PushNotificationService,
    private readonly subscriptionService: PushSubscriptionService,
    private readonly logService: NotificationLogService,
    private readonly config: ConfigService,
  ) {}

  @Get('notifications/vapid-public-key')
  @Public()
  @ApiOperation({ summary: 'Returns the VAPID public key for client subscription (public)' })
  getVapidPublicKey(): { publicKey: string } {
    return { publicKey: this.config.get<string>('VAPID_PUBLIC_KEY', '') };
  }

  @Post('notifications/send')
  @HttpCode(HttpStatus.ACCEPTED)
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({ summary: 'Send a push notification to selected targets' })
  send(
    @Body() dto: SendNotificationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ accepted: boolean; warning?: string }> {
    return this.notificationService.send(dto, user.sub);
  }

  @Get('notifications/history')
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({ summary: 'List past notification sends (manual and scheduled)' })
  getHistory(@Query() filter: NotificationLogFilterDto): Promise<PaginatedResponse<NotificationLog>> {
    return this.logService.findAll(filter);
  }

  @Get('push-subscriptions/summary')
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({ summary: 'List persons with their active device count and last push date' })
  getSummary(): Promise<DeviceSummary[]> {
    return this.subscriptionService.getSummary();
  }
}
