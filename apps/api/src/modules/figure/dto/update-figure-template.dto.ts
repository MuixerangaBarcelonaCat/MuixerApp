import { ApiPropertyOptional } from '@nestjs/swagger';
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
import { CreateRenglaDto } from './create-rengla.dto';

export class UpdateFigureTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  hasPinya?: boolean;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  direction?: number;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: [CreateFigureNodeDto],
    description:
      'Node list with upsert semantics. Nodes with matching IDs are updated; nodes without IDs are created; existing nodes not in the list are deleted.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFigureNodeDto)
  @IsOptional()
  nodes?: CreateFigureNodeDto[];

  @ApiPropertyOptional({
    type: [CreateRenglaDto],
    description:
      'Rengla list with upsert semantics. Rengles with matching IDs are updated; rengles without IDs are created; existing rengles not in the list are deleted.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateRenglaDto)
  @IsOptional()
  rengles?: CreateRenglaDto[];
}
