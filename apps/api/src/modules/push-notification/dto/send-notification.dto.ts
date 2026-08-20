import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
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
import { AttendanceStatus, NotificationTargetType } from '@muixer/shared';

class NotificationTargetDto {
  @IsEnum(NotificationTargetType)
  type: NotificationTargetType;

  @IsUUID()
  @ValidateIf((o: NotificationTargetDto) => o.type === NotificationTargetType.EVENT_ATTENDANCE)
  @IsNotEmpty()
  eventId?: string;

  @IsEnum(AttendanceStatus)
  @IsOptional()
  @ValidateIf((o: NotificationTargetDto) => o.type === NotificationTargetType.EVENT_ATTENDANCE)
  @IsIn([AttendanceStatus.PENDENT, AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG])
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

  /** Absolute https/http URL or an in-app path such as `/noticies/123`. */
  @Matches(/^(https?:\/\/\S+|\/[^\s?#]*(\?\S*)?(#\S*)?)$/, {
    message: 'url ha de ser una URL absoluta o un cami intern que comenci per /',
  })
  @IsOptional()
  url?: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => NotificationTargetDto)
  target: NotificationTargetDto;
}
