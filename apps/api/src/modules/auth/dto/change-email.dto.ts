import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangeEmailDto {
  @ApiProperty({ description: 'Nou correu electrònic' })
  @IsEmail()
  newEmail: string;

  @ApiProperty({ description: 'Contrasenya actual, per confirmar la identitat' })
  @IsString()
  currentPassword: string;
}
