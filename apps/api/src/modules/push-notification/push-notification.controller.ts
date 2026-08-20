import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DeviceSummary, UserRole } from '@muixer/shared';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';
import { SendNotificationDto } from './dto/send-notification.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller()
export class PushNotificationController {
  constructor(
    private readonly notificationService: PushNotificationService,
    private readonly subscriptionService: PushSubscriptionService,
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
  send(@Body() dto: SendNotificationDto): Promise<{ accepted: boolean; warning?: string }> {
    return this.notificationService.send(dto);
  }

  @Get('push-subscriptions/summary')
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({ summary: 'List persons with their active device count and last push date' })
  getSummary(): Promise<DeviceSummary[]> {
    return this.subscriptionService.getSummary();
  }
}
