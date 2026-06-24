import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FigureMode } from '@muixer/shared';

export class UpdateInstanceDto {
  @ApiPropertyOptional({ description: 'Label override for this instance' })
  @IsString()
  @IsOptional()
  label?: string | null;

  @ApiPropertyOptional({ description: 'Sort order within the segment' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;

  @ApiPropertyOptional({ enum: FigureMode, description: 'Build mode for the figure' })
  @IsEnum(FigureMode)
  @IsOptional()
  figureMode?: FigureMode;
}
