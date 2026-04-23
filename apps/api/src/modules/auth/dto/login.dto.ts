import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ClientType } from '@muixer/shared';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsEnum(ClientType)
  clientType: ClientType;
}
