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
    description: 'Full replacement of node list. Nodes with matching IDs are updated; missing IDs are deleted; new ones are created.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateFigureNodeDto)
  @IsOptional()
  nodes?: CreateFigureNodeDto[];
}
