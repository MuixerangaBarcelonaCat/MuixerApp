import { IsEmail, IsUUID } from 'class-validator';

export class CreateWithInviteDto {
  @IsEmail()
  email: string;

  @IsUUID()
  personId: string;
}
