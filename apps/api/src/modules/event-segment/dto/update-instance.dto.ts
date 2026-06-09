import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateInstanceDto {
  @ApiPropertyOptional({ description: 'Label override for this instance' })
  @IsString()
  @IsOptional()
  label?: string | null;

  @ApiPropertyOptional({ description: 'Sort order within the segment' })
  @IsInt()
  @Min(0)
  @IsOptional()
  @Type(() => Number)
  sortOrder?: number;
}
