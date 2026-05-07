import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFigureNodeDto } from './create-figure-node.dto';

export class CreateFigureTemplateDto {
  @ApiProperty({ description: 'Unique human-readable name, e.g. "Pinet Doble de 4"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique URL-safe slug, e.g. "pd4"' })
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
