// ---------------------------------------------------------------------------
// DESACTIVAT amb l'endpoint POST /users/recovery-link.
// El fitxer es manté per poder rehabilitar el mecanisme descomentant-lo. Cal descomentar
// també `RecoveryLinkResponse` a libs/shared/src/interfaces/invite.interfaces.ts.
// Context i instruccions: apps/api/src/modules/user/user.controller.ts i docs/AUTH_FLOW.md §8.1.
// ---------------------------------------------------------------------------
// import { ApiProperty } from '@nestjs/swagger';
// import { RecoveryLinkResponse } from '@muixer/shared';
//
// export class RecoveryLinkResponseDto implements RecoveryLinkResponse {
//   @ApiProperty({ description: 'URL per triar una contrasenya nova, a reenviar al membre' })
//   recoveryUrl: string;
//
//   @ApiProperty({ description: "Data de caducitat de l'enllaç (ISO 8601)" })
//   expiresAt: string;
// }
export {};
