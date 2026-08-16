import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Contrasenya actual' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ description: 'Nova contrasenya (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
