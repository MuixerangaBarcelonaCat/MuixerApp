import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCompositionSlotDto } from './create-composition-slot.dto';

export class UpdateCompositionTemplateDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    type: [CreateCompositionSlotDto],
    description: 'When provided, fully replaces all existing slots',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCompositionSlotDto)
  @IsOptional()
  slots?: CreateCompositionSlotDto[];
}
