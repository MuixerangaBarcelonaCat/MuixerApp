import { IsString, IsOptional, MaxLength, IsISO8601 } from 'class-validator';

export class CreateNewsDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  body: string;

  /** Nullable/omitted = draft. Past/now = publish immediately. Future = scheduled. */
  @IsOptional()
  @IsISO8601()
  publishedAt?: string;
}
