import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateCompositionSlotDto {
  @ApiProperty({ description: 'UUID of the FigureTemplate to reference' })
  @IsUUID('4')
  @IsNotEmpty()
  figureTemplateId: string;

  @ApiPropertyOptional({ description: 'Custom label for this slot, e.g. "pd4 central"' })
  @IsString()
  @IsOptional()
  label?: string;

  @ApiProperty({ description: 'Horizontal offset in canvas units', default: 0 })
  @IsNumber()
  offsetX: number;

  @ApiProperty({ description: 'Vertical offset in canvas units', default: 0 })
  @IsNumber()
  offsetY: number;

  @ApiPropertyOptional({ description: 'Visual sort order', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;
}
