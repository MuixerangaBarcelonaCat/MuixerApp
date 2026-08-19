import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Attendance } from '../event/attendance.entity';
import { News } from '../news/news.entity';
import { PushSubscription } from './entities/push-subscription.entity';
import { PUSH_PROVIDER } from './push-provider.interface';
import { ConsolePushProvider } from './providers/console-push.provider';
import { WebPushProvider } from './providers/web-push.provider';
import { PushSenderService } from './push-sender.service';
import { PushSubscriptionService } from './push-subscription.service';
import { PushNotificationService } from './push-notification.service';
import { PushNotificationCronService } from './push-notification-cron.service';
import { PushSubscriptionController } from './push-subscription.controller';
import { PushNotificationController } from './push-notification.controller';

/**
 * Picks the concrete PushProvider from PUSH_PROVIDER env var (default 'console', a dev-safe stub
 * that logs instead of sending). Swapping providers later only requires a new case here.
 */
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([PushSubscription, User, Attendance, News]),
  ],
  controllers: [PushSubscriptionController, PushNotificationController],
  providers: [
    PushSenderService,
    PushSubscriptionService,
    PushNotificationService,
    PushNotificationCronService,
    {
      provide: PUSH_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('PUSH_PROVIDER', 'console');
        switch (provider) {
          case 'console':
            return new ConsolePushProvider();
          case 'web-push':
            return new WebPushProvider(config);
          default:
            throw new Error(`Unsupported PUSH_PROVIDER: ${provider}`);
        }
      },
    },
  ],
  exports: [PushSubscriptionService, PushNotificationService],
})
export class PushNotificationModule {}
