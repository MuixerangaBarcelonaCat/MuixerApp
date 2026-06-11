import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  Min,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  FigureZone,
  NodeShape,
  PINYA_POSITION_TYPES,
  AD_HOC_ALLOWED_ZONES_PHASE1,
} from '@muixer/shared';

export class CreateAdHocNodeDto {
  @IsIn([...AD_HOC_ALLOWED_ZONES_PHASE1])
  zone: FigureZone;

  @IsOptional()
  @IsIn([...PINYA_POSITION_TYPES])
  positionType?: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;

  @IsNumber()
  x: number;

  @IsNumber()
  y: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  width?: number;

  @IsOptional()
  @IsNumber()
  @Min(10)
  height?: number;

  @IsOptional()
  @IsNumber()
  rotation?: number;

  @IsOptional()
  @IsIn(Object.values(NodeShape))
  shape?: NodeShape;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;
}
