import { ApiProperty } from '@nestjs/swagger';

export class InviteLinkResponseDto {
  @ApiProperty({ description: "URL d'activació a enviar al membre" })
  inviteUrl: string;

  @ApiProperty({ description: "Data de caducitat de l'enllaç (ISO 8601)" })
  expiresAt: string;
}
