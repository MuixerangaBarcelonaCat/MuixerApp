import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateInstanceDto {
  @ApiPropertyOptional({ description: 'ID of a FigureTemplate' })
  @IsUUID('4')
  @IsOptional()
  figureTemplateId?: string;

  @ApiPropertyOptional({ description: 'Optional label override for the instance' })
  @IsString()
  @IsOptional()
  label?: string;
}
