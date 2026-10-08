import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { FigureMode } from '@muixer/shared';

export class UpdateInstanceDto {
  @ApiPropertyOptional({ description: 'Label override for this instance' })
  @IsString()
  @IsOptional()
  label?: string | null;

  @ApiPropertyOptional({ enum: FigureMode, description: 'Build mode for the figure' })
  @IsEnum(FigureMode)
  @IsOptional()
  figureMode?: FigureMode;
}
