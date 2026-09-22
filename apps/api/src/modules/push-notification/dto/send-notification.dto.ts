import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  ValidateNested,
  IsEnum,
  IsUUID,
  IsArray,
  IsIn,
  ValidateIf,
  IsDefined,
  Matches,
} from 'class-validator';
import { AttendanceStatus, EventReferenceKind, NotificationLinkType, NotificationTargetType } from '@muixer/shared';

class EventReferenceDto {
  @IsEnum(EventReferenceKind)
  kind: EventReferenceKind;

  /** Only required for SPECIFIC — the other kinds resolve a concrete event at send time. */
  @IsUUID()
  @ValidateIf((o: EventReferenceDto) => o.kind === EventReferenceKind.SPECIFIC)
  @IsNotEmpty()
  eventId?: string;
}

class NotificationTargetDto {
  @IsEnum(NotificationTargetType)
  type: NotificationTargetType;

  /** Required for EVENT_ATTENDANCE — an unfiltered "everyone with an attendance record" is
   *  indistinguishable from the ALL target, so a specific response must be chosen. */
  @IsEnum(AttendanceStatus)
  @ValidateIf((o: NotificationTargetDto) => o.type === NotificationTargetType.EVENT_ATTENDANCE)
  @IsIn([AttendanceStatus.PENDENT, AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG, AttendanceStatus.ASSISTIT])
  attendanceFilter?: AttendanceStatus;

  @IsArray()
  @IsUUID('4', { each: true })
  @ValidateIf((o: NotificationTargetDto) => o.type === NotificationTargetType.PERSON)
  @IsNotEmpty()
  personIds?: string[];
}

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  @Transform(({ value }) => value?.trim())
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  @Transform(({ value }) => value?.trim())
  body: string;

  /**
   * The event this notification is about — independent of who receives it. Required whenever
   * `linkTo === EVENT` (the link resolves against it) or `target.type === EVENT_ATTENDANCE`
   * (attendees are resolved against it).
   */
  @ValidateNested()
  @Type(() => EventReferenceDto)
  @ValidateIf(
    (o: SendNotificationDto) =>
      o.linkTo === NotificationLinkType.EVENT || o.target?.type === NotificationTargetType.EVENT_ATTENDANCE,
  )
  @IsDefined()
  linkedEvent?: EventReferenceDto;

  @IsEnum(NotificationLinkType)
  linkTo: NotificationLinkType;

  /** Absolute https/http URL or an in-app path such as `/noticies/123`. Only used (and required) when `linkTo === CUSTOM`. */
  @Matches(/^(https?:\/\/\S+|\/[^\s?#]*(\?\S*)?(#\S*)?)$/, {
    message: 'url ha de ser una URL absoluta o un cami intern que comenci per /',
  })
  @ValidateIf((o: SendNotificationDto) => o.linkTo === NotificationLinkType.CUSTOM)
  @IsNotEmpty()
  url?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationTargetDto)
  target: NotificationTargetDto;
}
