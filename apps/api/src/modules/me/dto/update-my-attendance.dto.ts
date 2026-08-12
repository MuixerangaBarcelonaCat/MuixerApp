import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { AttendanceStatus } from '@muixer/shared';

const MEMBER_STATUSES = [
  AttendanceStatus.PENDENT,
  AttendanceStatus.ANIRE,
  AttendanceStatus.NO_VAIG,
] as const;

export class UpdateMyAttendanceDto {
  @IsEnum(AttendanceStatus)
  @IsIn(MEMBER_STATUSES)
  status: AttendanceStatus;

  @IsOptional()
  @IsUUID()
  personId?: string;
}
