import { IsString, IsOptional, IsEnum, MaxLength } from 'class-validator';
import { FigureZone } from '@muixer/shared';

export class CreatePositionDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(100)
  slug: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  shortDescription?: string;

  @IsString()
  @IsOptional()
  longDescription?: string;

  @IsString()
  @IsOptional()
  @MaxLength(7)
  color?: string;

  @IsEnum(FigureZone)
  @IsOptional()
  zone?: FigureZone;
}
