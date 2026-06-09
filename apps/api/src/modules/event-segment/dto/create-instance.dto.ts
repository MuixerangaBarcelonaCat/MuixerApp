import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInstanceDto {
  @ApiPropertyOptional({ description: 'ID of a FigureTemplate. Mutually exclusive with compositionTemplateId.' })
  @IsUUID('4')
  @IsOptional()
  figureTemplateId?: string;

  @ApiPropertyOptional({ description: 'ID of a CompositionTemplate. Mutually exclusive with figureTemplateId.' })
  @IsUUID('4')
  @IsOptional()
  compositionTemplateId?: string;

  @ApiPropertyOptional({ description: 'Optional label override for the instance' })
  @IsString()
  @IsOptional()
  label?: string;
}
