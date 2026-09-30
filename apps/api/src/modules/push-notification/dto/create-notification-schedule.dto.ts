import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf, ValidateNested, IsDefined } from 'class-validator';
import { BeforeEventOffsetUnit, EventType, NotificationScheduleType } from '@muixer/shared';
import { NotificationContentDto } from './notification-content.dto';

/** `YYYY-MM-DD`, inclusive, evaluated in the Europe/Madrid timezone. */
const DATE_ONLY_REGEX = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

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

  /** Optional — an unbounded start/end means the schedule fires from the moment it's created / indefinitely. */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'startDate ha de tenir el format YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'endDate ha de tenir el format YYYY-MM-DD' })
  endDate?: string;
}

export class BeforeEventRuleConfigDto {
  /** Only ACTUACIO is meaningful today, but the field stays generic. */
  @IsEnum(EventType)
  eventType: EventType;

  @IsEnum(BeforeEventOffsetUnit)
  offsetUnit: BeforeEventOffsetUnit;

  /** How many days or hours before the event, depending on `offsetUnit`. */
  @IsInt()
  @Min(1)
  offsetValue: number;

  /** `HH:mm`, evaluated in the Europe/Madrid timezone. Required for `DAYS` (fires at this time of
   *  day, `offsetValue` days before the event's date) — unused for `HOURS`, which instead fires
   *  `offsetValue` hours before the event's own `startTime`. */
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'timeOfDay ha de tenir el format HH:mm' })
  @ValidateIf((o: BeforeEventRuleConfigDto) => o.offsetUnit === BeforeEventOffsetUnit.DAYS)
  @IsDefined()
  timeOfDay?: string;

  /** Optional — an unbounded start/end means the schedule watches for matching events from the
   *  moment it's created / indefinitely. */
  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'startDate ha de tenir el format YYYY-MM-DD' })
  startDate?: string;

  @IsOptional()
  @Matches(DATE_ONLY_REGEX, { message: 'endDate ha de tenir el format YYYY-MM-DD' })
  endDate?: string;
}

export class CreateNotificationScheduleDto extends NotificationContentDto {
  @IsEnum(NotificationScheduleType)
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

  @ValidateNested()
  @Type(() => BeforeEventRuleConfigDto)
  @ValidateIf((o: CreateNotificationScheduleDto) => o.scheduleType === NotificationScheduleType.BEFORE_EVENT)
  @IsDefined()
  beforeEvent?: BeforeEventRuleConfigDto;
}
