import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompositionSlotDto } from './create-composition-slot.dto';

export class CreateCompositionTemplateDto {
  @ApiProperty({ description: 'Unique name, e.g. "Altar"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'Unique URL-safe slug, e.g. "altar"' })
  @IsString()
  @IsNotEmpty()
  slug: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ type: [CreateCompositionSlotDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompositionSlotDto)
  slots: CreateCompositionSlotDto[];
}
