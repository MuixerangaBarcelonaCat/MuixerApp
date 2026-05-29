import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFigureNodeDto } from './create-figure-node.dto';

export class CreateFigureTemplateDto {
  @ApiProperty({ description: 'UUID of the FigureFamily this template belongs to' })
  @IsUUID()
  @IsNotEmpty()
  familyId: string;

  @ApiPropertyOptional({
    description: 'Position within the family (1 = smallest variant). Defaults to max + 1.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  variantOrder?: number;

  @ApiProperty({ description: 'Unique human-readable name, e.g. "Pinet Doble de 4 — 2C"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique URL-safe slug, e.g. "pd4-2c"' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  hasPinya?: boolean;

  @ApiPropertyOptional({ description: 'Default direction in degrees (0–360)', default: 0 })
  @IsNumber()
  @IsOptional()
  direction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiProperty({ type: [CreateFigureNodeDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFigureNodeDto)
  nodes: CreateFigureNodeDto[];
}
