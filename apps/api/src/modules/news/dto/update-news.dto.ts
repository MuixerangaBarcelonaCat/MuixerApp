import { IsString, IsOptional, MaxLength, IsISO8601, ValidateIf } from 'class-validator';

export class UpdateNewsDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  body?: string;

  /** Explicit `null` reverts the news to draft; omit the field to leave `publishedAt` untouched. */
  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601()
  publishedAt?: string | null;
}
