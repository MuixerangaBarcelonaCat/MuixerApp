import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Min,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { NodeShape } from '@muixer/shared';

export class UpdateAdHocNodeDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @IsOptional()
  @IsNumber()
  x?: number;

  @IsOptional()
  @IsNumber()
  y?: number;

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
  @Matches(/^#[0-9a-fA-F]{6}$/)
  color?: string;

  @IsOptional()
  @IsIn(Object.values(NodeShape))
  shape?: NodeShape;
}
