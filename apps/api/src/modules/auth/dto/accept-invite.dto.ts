import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteDto {
  @ApiProperty({ description: 'Token d\'invitació rebut per correu electrònic' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Nova contrasenya per al compte (mínim 8 caràcters)', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
