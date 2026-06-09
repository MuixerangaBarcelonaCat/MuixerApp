import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ClientType } from '@muixer/shared';

export class LoginDto {
  @ApiProperty({ description: 'Correu electrònic de l\'usuari', example: 'tecnic@muixeranga.cat' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Contrasenya de l\'usuari (mínim 6 caràcters)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password: string;

  @ApiProperty({ description: 'Tipus de client que fa la petició de login', enum: ClientType, example: ClientType.DASHBOARD })
  @IsEnum(ClientType)
  clientType: ClientType;
}
