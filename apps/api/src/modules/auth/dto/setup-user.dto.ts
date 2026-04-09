import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole } from '@muixer/shared';

export class SetupUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum([UserRole.TECHNICAL, UserRole.ADMIN])
  @IsOptional()
  role?: UserRole.TECHNICAL | UserRole.ADMIN;

  @IsUUID()
  @IsOptional()
  personId?: string;
}
