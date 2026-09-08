// ---------------------------------------------------------------------------
// DESACTIVAT amb l'endpoint POST /users/recovery-link.
// El fitxer es manté per poder rehabilitar el mecanisme descomentant-lo.
// Context i instruccions: apps/api/src/modules/user/user.controller.ts i docs/AUTH_FLOW.md §8.1.
// ---------------------------------------------------------------------------
// import { IsUUID } from 'class-validator';
// import { ApiProperty } from '@nestjs/swagger';
//
// export class CreateRecoveryLinkDto {
//   @ApiProperty({ description: 'ID de la persona que ha perdut l\'accés al seu compte' })
//   @IsUUID()
//   personId: string;
// }
export {};
