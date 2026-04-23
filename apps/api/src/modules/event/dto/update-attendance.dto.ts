import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@muixer/shared';

export class UpdateAttendanceDto {
  @ApiPropertyOptional({ description: 'Nou estat d\'assistència', enum: AttendanceStatus })
  @IsOptional()
  @IsEnum(AttendanceStatus)
  status?: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Notes addicionals (null per esborrar)' })
  @IsOptional()
  @IsString()
  notes?: string | null;
}
