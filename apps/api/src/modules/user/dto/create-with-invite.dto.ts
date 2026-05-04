import { IsEmail, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateWithInviteDto {
  @ApiProperty({description: "Correu on enviar la invitació"})
  @IsEmail()
  email: string;

  @ApiProperty({description: "ID de la persona"})
  @IsUUID()
  personId: string;
}
