import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de restabliment rebut per correu electrònic' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Nova contrasenya (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
