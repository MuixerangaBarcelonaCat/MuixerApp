import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class SetupTechnicalDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsUUID()
  @IsOptional()
  personId?: string;
}
