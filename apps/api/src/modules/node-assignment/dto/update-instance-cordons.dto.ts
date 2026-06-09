import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdateInstanceCordonsDto {
  @ApiPropertyOptional({ description: 'Number of cordons to show. NULL = all visible.' })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfCordons?: number | null;

  @ApiPropertyOptional({ description: 'Rengla IDs with open cordon active. NULL or empty = none.' })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  openCordons?: string[] | null;
}
