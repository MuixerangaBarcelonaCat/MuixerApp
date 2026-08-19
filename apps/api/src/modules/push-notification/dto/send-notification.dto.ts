import { Transform, Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUrl,
  ValidateNested,
  IsEnum,
  IsUUID,
  IsArray,
  IsIn,
  ValidateIf,
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

  @IsUrl({ protocols: ['https', 'http'], require_tld: false })
  @IsOptional()
  url?: string;

  @ValidateNested()
  @Type(() => NotificationTargetDto)
  target: NotificationTargetDto;
}
