import { IsString, IsOptional, MaxLength, IsISO8601, IsBoolean } from 'class-validator';

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

  /** When true, a push notification is sent to all members once publishedAt is reached. */
  @IsOptional()
  @IsBoolean()
  sendPush?: boolean;
}
