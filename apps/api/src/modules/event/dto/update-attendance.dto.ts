import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'Força el canvi encara que l\'event estiga bloquejat (queda auditat)' })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
