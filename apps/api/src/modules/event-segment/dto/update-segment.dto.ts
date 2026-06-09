import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSegmentDto {
  @ApiPropertyOptional({ description: 'Custom segment name. Set to null to revert to auto-generated.' })
  @IsString()
  @IsOptional()
  name?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  startTime?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  endTime?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Visibility toggle for members (PWA)' })
  @IsBoolean()
  @IsOptional()
  isVisible?: boolean;
}
