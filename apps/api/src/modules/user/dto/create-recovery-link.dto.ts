import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRecoveryLinkDto {
  @ApiProperty({ description: 'ID de la persona que ha perdut l\'accés al seu compte' })
  @IsUUID()
  personId: string;
}
