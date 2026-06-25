import { IsString, IsOptional, MaxLength, IsArray } from 'class-validator';

export class CreateTagDto {
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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  positionTypes?: string[];
}
