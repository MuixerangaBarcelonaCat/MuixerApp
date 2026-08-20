import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class UnsubscribeDto {
  @IsUrl({ protocols: ['https'], require_tld: true })
  @IsNotEmpty()
  endpoint: string;
}
