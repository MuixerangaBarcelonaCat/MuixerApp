import { IsString, IsOptional, MaxLength, IsArray, IsNotEmpty } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
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
