import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { Column } from 'typeorm';

export class CreateInstanceDto {
  @ApiPropertyOptional({
    description:
      'ID of a FigureTemplate. Mutually exclusive with compositionTemplateId.',
  })
  @IsUUID('4')
  @IsOptional()
  figureTemplateId?: string;

  @ApiPropertyOptional({
    description:
      'ID of a CompositionTemplate. Mutually exclusive with figureTemplateId.',
  })
  @IsUUID('4')
  @IsOptional()
  compositionTemplateId?: string;

  @ApiPropertyOptional({
    description: 'Optional label override for the instance',
  })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional({ description: 'Number of cordons' })
  @IsInt()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  numberOfCordons: number | null;

  @ApiPropertyOptional({ description: 'List of open cordons' })
  @IsOptional()
  openCordons: string[];
}
