import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';

export class SetupUserDto {
  @ApiProperty({ description: 'Correu electrònic del primer usuari tècnic', example: 'admin@muixeranga.cat' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contrasenya inicial (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'Rol assignat a l\'usuari creat. Per defecte TECHNICAL.', enum: [UserRole.TECHNICAL, UserRole.ADMIN] })
  @IsEnum([UserRole.TECHNICAL, UserRole.ADMIN])
  @IsOptional()
  role?: UserRole.TECHNICAL | UserRole.ADMIN;

  @ApiPropertyOptional({ description: 'UUID de la persona a vincular amb el compte d\'usuari (opcional)' })
  @IsUUID()
  @IsOptional()
  personId?: string;
}
