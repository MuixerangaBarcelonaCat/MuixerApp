import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumber,
  IsInt,
  IsBoolean,
  IsEnum,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FigureMode } from '@muixer/shared';

export class CreateCompositionEntryDto {
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

  /** Rotation in degrees */
  @IsOptional()
  @IsNumber()
  angle?: number;

  /** null = linked (auto above figure) */
  @IsOptional()
  @IsNumber()
  troncPanelX?: number | null;

  @IsOptional()
  @IsNumber()
  troncPanelY?: number | null;

  @IsOptional()
  @IsEnum(FigureMode)
  figureMode?: FigureMode;

  /** null = all cordons visible */
  @IsOptional()
  @IsInt()
  numberOfCordons?: number | null;

  @IsOptional()
  @IsBoolean()
  cordonsObertsEnabled?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;
}

export class CreateCompositionDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => CreateCompositionEntryDto)
  entries?: CreateCompositionEntryDto[];
}
