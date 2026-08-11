import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Correu electrònic del compte a recuperar', example: 'tecnic@muixeranga.cat' })
  @IsEmail()
  email: string;
}
