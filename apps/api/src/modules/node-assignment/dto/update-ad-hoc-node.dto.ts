import {
  IsString,
  IsNumber,
  IsOptional,
  IsIn,
  MaxLength,
  MinLength,
  Min,
  Matches,
  ValidateIf,
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
  @ValidateIf((_o, value) => value !== null && value !== undefined)
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'color ha de ser un hex de 6 dígits (#RRGGBB).' })
  color?: string | null;

  @IsOptional()
  @IsIn(Object.values(NodeShape))
  shape?: NodeShape;
}
