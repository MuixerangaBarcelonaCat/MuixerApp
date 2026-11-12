import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  MaxLength,
  IsUrl,
  ValidateNested,
  IsDefined,
  IsBoolean,
} from 'class-validator';

const ALLOWED_PUSH_DOMAINS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];

class PushKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

export class RegisterSubscriptionDto {
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsNotEmpty()
  endpoint: string;

  @IsDefined()
  @ValidateNested()
  @Type(() => PushKeysDto)
  keys: PushKeysDto;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  userAgent?: string;

  /** Automatic re-register on PWA startup (not asked by the member): never re-enables a removed device. */
  @IsBoolean()
  @IsOptional()
  silent?: boolean;

  get endpointDomain(): string {
    try {
      return new URL(this.endpoint).hostname;
    } catch {
      return '';
    }
  }

  isEndpointAllowed(): boolean {
    const domain = this.endpointDomain;
    return ALLOWED_PUSH_DOMAINS.some((allowed) => domain === allowed || domain.endsWith(`.${allowed}`));
  }
}

/** Exported for use in validation guard inside the service. */
export { ALLOWED_PUSH_DOMAINS };
