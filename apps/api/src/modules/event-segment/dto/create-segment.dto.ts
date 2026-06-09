import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateSegmentDto {
  @ApiPropertyOptional({ description: 'Custom segment name. Null = auto-generated from figures on the frontend.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Informational start time, e.g. "19:30"' })
  @IsString()
  @IsOptional()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Informational end time, e.g. "20:00"' })
  @IsString()
  @IsOptional()
  endTime?: string;

  @ApiPropertyOptional({ description: 'Internal technician notes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
