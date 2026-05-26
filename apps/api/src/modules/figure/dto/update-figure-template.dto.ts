import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateFigureNodeDto } from './create-figure-node.dto';

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
  @IsInt()
  @Min(1)
  @IsOptional()
  variantOrder?: number;

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
}
