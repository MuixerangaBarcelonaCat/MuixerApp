import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, ValidateIf, ValidateNested, IsDefined } from 'class-validator';
import { NotificationScheduleType } from '@muixer/shared';
import { NotificationContentDto } from './notification-content.dto';

export class OneOffRuleConfigDto {
  /** ISO datetime the notification should fire at. Past-dated values are accepted at the DTO
   *  level — `NotificationScheduleService.create` is what rejects them, since "now" depends on
   *  request time, not something class-validator can check statically. */
  @IsDateString()
  scheduledFor: string;
}

export class CreateNotificationScheduleDto extends NotificationContentDto {
  /** Only ONE_OFF is implemented so far; WEEKLY/BEFORE_EVENT are reserved for later phases. */
  @IsEnum(NotificationScheduleType)
  @IsIn([NotificationScheduleType.ONE_OFF], { message: "Només s'admeten notificacions puntuals (ONE_OFF) per ara" })
  scheduleType: NotificationScheduleType;

  @ValidateNested()
  @Type(() => OneOffRuleConfigDto)
  @ValidateIf((o: CreateNotificationScheduleDto) => o.scheduleType === NotificationScheduleType.ONE_OFF)
  @IsDefined()
  oneOff?: OneOffRuleConfigDto;
}
