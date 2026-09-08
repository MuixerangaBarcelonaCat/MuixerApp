import { ApiProperty } from '@nestjs/swagger';
import { RecoveryLinkResponse } from '@muixer/shared';

export class RecoveryLinkResponseDto implements RecoveryLinkResponse {
  @ApiProperty({ description: 'URL per triar una contrasenya nova, a reenviar al membre' })
  recoveryUrl: string;

  @ApiProperty({ description: "Data de caducitat de l'enllaç (ISO 8601)" })
  expiresAt: string;
}
