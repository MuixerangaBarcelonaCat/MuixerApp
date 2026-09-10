import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditAction, UserRole, JwtPayload } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { UserService } from './user.service';
import { CreateInviteLinkDto } from './dto/create-invite-link.dto';
import { InviteLinkResponseDto } from './dto/invite-link-response.dto';
// DESACTIVAT — enllaç de recuperació generat per un tècnic. Vegeu el bloc comentat
// de `recovery-link` més avall i docs/AUTH_FLOW.md §8.1.
// import { CreateRecoveryLinkDto } from './dto/create-recovery-link.dto';
// import { RecoveryLinkResponseDto } from './dto/recovery-link-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GrantUserRoleDto } from './dto/grant-user-role.dto';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly auditService: AuditService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crea un usuari TECHNICAL/ADMIN amb contrasenya' })
  @ApiResponse({ status: 201, description: 'Usuari creat correctament' })
  @ApiResponse({ status: 400, description: 'Dades invàlides' })
  @ApiResponse({ status: 409, description: 'Email ja existeix' })
  createUser(
    @Body() dto: CreateUserDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.createUser(dto, actor.role);
  }

  @Post('invite-link')
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({
    summary: "Crea (o regenera) un enllaç d'invitació per activar el compte d'una persona",
  })
  @ApiResponse({ status: 201, description: "Enllaç d'invitació generat" })
  @ApiResponse({ status: 400, description: "La persona no existeix o ja té un compte actiu" })
  createInviteLink(@Body() dto: CreateInviteLinkDto): Promise<InviteLinkResponseDto> {
    return this.userService.createOrRefreshInviteLink(dto.personId);
  }

  // ---------------------------------------------------------------------------
  // DESACTIVAT: POST /users/recovery-link
  //
  // Aquest endpoint permetia que un ADMIN/TECHNICAL generés un enllaç per triar una
  // contrasenya nova d'un compte ja actiu, i el reenviés a mà (WhatsApp) al membre que no
  // recorda la contrasenya i no pot arribar al seu correu.
  //
  // Per què està desactivat: l'enllaç és un token portador («bearer»). Qui el tinga entra al
  // compte, sense cap comprovació d'identitat. Si el tècnic l'envia al número equivocat, o el
  // receptor el reenvia a un grup, qualsevol pot ocupar el compte d'un altre membre. De moment
  // ens quedem només amb «Heu oblidat la contrasenya?» del login, que envia el token al correu
  // del propietari del compte i per tant no depèn del criteri de qui el reenvia.
  //
  // Per tornar-lo a habilitar cal descomentar, en aquest ordre:
  //   1. `UserService.createRecoveryLink` i les seues dependències (user.service.ts)
  //   2. `AuditModule` a user.module.ts
  //   3. `RECOVERY_LINK_TTL_HOURS` a auth/constants/auth.constants.ts
  //   4. `RecoveryLinkResponse` a libs/shared/src/interfaces/invite.interfaces.ts
  //   5. `RECOVERY_LINK_CREATED` a libs/shared/src/enums/audit-action.enum.ts
  //   6. Aquest bloc i els seus dos imports
  //   7. `PersonService.createRecoveryLink` i el botó del detall de persona (dashboard)
  // Abans de fer-ho, llegiu les mitigacions proposades a docs/AUTH_FLOW.md §8.1: TTL curt,
  // auditoria del consum i avís al propietari. Els tests corresponents estan al commit e2f5e96.
  // ---------------------------------------------------------------------------
  // @Post('recovery-link')
  // @ApiOperation({
  //   summary: "Crea un enllaç per triar una contrasenya nova, per a un compte ja actiu",
  //   description:
  //     "Alternativa a «Heu oblidat la contrasenya?» quan el membre no té accés al seu correu: " +
  //     "l'enllaç el genera un ADMIN/TECHNICAL i el reenvia a mà. Queda auditat.",
  // })
  // @ApiResponse({ status: 201, description: 'Enllaç de recuperació generat' })
  // @ApiResponse({
  //   status: 400,
  //   description: "La persona no existeix, no té compte, o el compte encara no s'ha activat",
  // })
  // createRecoveryLink(
  //   @Body() dto: CreateRecoveryLinkDto,
  //   @CurrentUser() actor: JwtPayload,
  // ): Promise<RecoveryLinkResponseDto> {
  //   return this.userService.createRecoveryLink(dto.personId, actor.sub);
  // }

  @Get()
  @ApiOperation({ summary: 'Llistar usuaris' })
  @ApiResponse({ status: 200, description: "Llista d'usuaris" })
  async findAll(
    @Query() filters: UserFilterDto,
    @CurrentUser() actor: JwtPayload,
    @Req() req?: Request,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    const result = await this.userService.findAll(filters);
    await this.auditService.record({
      actorUserId: actor.sub,
      action: AuditAction.SENSITIVE_DATA_ACCESS,
      targetType: 'User',
      metadata: {
        role: actor.role,
        route: '/users',
        page: filters.page || 1,
        resultCount: result.data.length,
      },
      ipAddress: req?.ip ?? null,
    });
    return result;
  }

  @Patch(':id/grant-role')
  @ApiOperation({ summary: 'Assigna un rol a un usuari' })
  @Roles(UserRole.ADMIN)
  @ApiResponse({ status: 200, description: 'Usuari actualitzat' })
  @ApiResponse({ status: 400, description: 'Error en assignar el rol' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  grantRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantUserRoleDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.grantRole(id, dto.role, actor.sub);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva un usuari' })
  @ApiResponse({ status: 204, description: 'Usuari desactivat' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    return this.userService.deactivateUser(id, actor.role, actor.sub);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Actualitza les dades d'un usuari" })
  @ApiResponse({ status: 200, description: 'Usuari actualitzat' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  @ApiResponse({ status: 409, description: 'Email ja existeix' })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(id, dto, actor.role, actor.sub);
  }

}