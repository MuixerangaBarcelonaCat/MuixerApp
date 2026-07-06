import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FigureMode } from '@muixer/shared';

export class UpdateCompositionEntryDto {
  @IsUUID()
  figureTemplateId: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsNumber()
  offsetX?: number;

  @IsOptional()
  @IsNumber()
  offsetY?: number;

  @IsOptional()
  @IsNumber()
  angle?: number;

  @IsOptional()
  @IsNumber()
  troncPanelX?: number | null;

  @IsOptional()
  @IsNumber()
  troncPanelY?: number | null;

  @IsOptional()
  @IsEnum(FigureMode)
  figureMode?: FigureMode;

  @IsOptional()
  @IsInt()
  numberOfCordons?: number | null;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class UpdateCompositionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => UpdateCompositionEntryDto)
  entries?: UpdateCompositionEntryDto[];
}
