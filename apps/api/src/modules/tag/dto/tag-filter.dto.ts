import { IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TagCategory } from '@muixer/shared';

export class TagFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar per categoria (multi-valor)', enum: TagCategory, isArray: true })
  @IsOptional()
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsEnum(TagCategory, { each: true })
  category?: TagCategory[];
}
