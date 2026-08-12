import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInviteLinkDto {
  @ApiProperty({ description: 'ID de la persona a convidar' })
  @IsUUID()
  personId: string;
}
