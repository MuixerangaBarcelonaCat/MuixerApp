import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AttendanceStatus } from '@muixer/shared';

export class CreateAttendanceDto {
  @ApiProperty({ description: 'UUID de la persona' })
  @IsUUID('4')
  @IsNotEmpty()
  personId: string;

  @ApiProperty({ description: 'Estat d\'assistència', enum: AttendanceStatus })
  @IsEnum(AttendanceStatus)
  status: AttendanceStatus;

  @ApiPropertyOptional({ description: 'Notes addicionals' })
  @IsOptional()
  @IsString()
  notes?: string;
}
