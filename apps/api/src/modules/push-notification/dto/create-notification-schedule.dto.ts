import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf, ValidateNested, IsDefined } from 'class-validator';
import { NotificationScheduleType } from '@muixer/shared';
import { NotificationContentDto } from './notification-content.dto';

export class OneOffRuleConfigDto {
  /** ISO datetime the notification should fire at. Past-dated values are accepted at the DTO
   *  level — `NotificationScheduleService.create` is what rejects them, since "now" depends on
   *  request time, not something class-validator can check statically. */
  @IsDateString()
  scheduledFor: string;
}

export class WeeklyRuleConfigDto {
  /** 0 (Sunday) .. 6 (Saturday), matching JS `Date.getDay()`. */
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  /** `HH:mm`, evaluated in the Europe/Madrid timezone. */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay ha de tenir el format HH:mm' })
  timeOfDay: string;

  /** `YYYY-MM-DD`, inclusive, evaluated in the Europe/Madrid timezone. Optional — an unbounded
   *  start/end means the schedule fires from the moment it's created / indefinitely. */
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'startDate ha de tenir el format YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, { message: 'endDate ha de tenir el format YYYY-MM-DD' })
  endDate?: string;
}

export class CreateNotificationScheduleDto extends NotificationContentDto {
  /** BEFORE_EVENT is reserved for a later phase. */
  @IsEnum(NotificationScheduleType)
  @IsIn([NotificationScheduleType.ONE_OFF, NotificationScheduleType.WEEKLY], {
    message: "Només s'admeten notificacions puntuals (ONE_OFF) o setmanals (WEEKLY) per ara",
  })
  scheduleType: NotificationScheduleType;

  @ValidateNested()
  @Type(() => OneOffRuleConfigDto)
  @ValidateIf((o: CreateNotificationScheduleDto) => o.scheduleType === NotificationScheduleType.ONE_OFF)
  @IsDefined()
  oneOff?: OneOffRuleConfigDto;

  @ValidateNested()
  @Type(() => WeeklyRuleConfigDto)
  @ValidateIf((o: CreateNotificationScheduleDto) => o.scheduleType === NotificationScheduleType.WEEKLY)
  @IsDefined()
  weekly?: WeeklyRuleConfigDto;
}
