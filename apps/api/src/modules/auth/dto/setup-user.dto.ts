import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * This endpoint bootstraps the very first account of the system and always
 * creates it as ADMIN — it does not accept a role. Bootstrapping any lesser
 * role here would permanently lock ADMIN-only features behind no ADMIN
 * account, since the endpoint refuses to run again once any user exists
 * (SEC-3).
 */
export class SetupUserDto {
  @ApiProperty({ description: 'Correu electrònic del primer usuari ADMIN', example: 'admin@muixeranga.cat' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contrasenya inicial (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'UUID de la persona a vincular amb el compte d\'usuari (opcional)' })
  @IsUUID()
  @IsOptional()
  personId?: string;
}
