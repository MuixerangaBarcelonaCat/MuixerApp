import { Equals, IsBoolean, IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PersonRegistrationDataDto } from '../../person/dto/person-registration-data.dto';

export class RegisterViaInviteDto extends PersonRegistrationDataDto {
  @ApiProperty({ description: "Token d'invitació rebut via enllaç" })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Adreça de correu del compte' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Nova contrasenya per al compte (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ description: 'Acceptació de la política de privacitat', default: false })
  @IsBoolean()
  @Equals(true, { message: 'Cal acceptar la política de privacitat per activar el compte' })
  legalAccepted: boolean;
}
