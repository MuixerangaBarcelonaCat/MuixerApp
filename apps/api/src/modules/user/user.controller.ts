import {
  Controller,
  Get,
  Delete,
  NotFoundException,
  Patch,
  Post,
  Body,
  Query,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditAction, UserRole, JwtPayload, UserSession, UserPushDevice, UserDevicesSummary } from '@muixer/shared';
import { PushSubscriptionService } from '../push-notification/push-subscription.service';
import { TokenService } from '../auth/token.service';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserService } from './user.service';
import { CreateInviteLinkDto } from './dto/create-invite-link.dto';
import { InviteLinkResponseDto } from './dto/invite-link-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserDevicesFilterDto } from './dto/user-devices-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GrantUserRoleDto } from './dto/grant-user-role.dto';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN, UserRole.TECHNICAL)
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly tokenService: TokenService,
    private readonly auditService: AuditService,
    private readonly pushSubscriptionService: PushSubscriptionService,
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
  @ApiOperation({
    summary: "Crea (o regenera) un enllaç d'invitació per activar el compte d'una persona",
  })
  @ApiResponse({ status: 201, description: "Enllaç d'invitació generat" })
  @ApiResponse({ status: 400, description: "La persona no existeix o ja té un compte actiu" })
  createInviteLink(@Body() dto: CreateInviteLinkDto): Promise<InviteLinkResponseDto> {
    return this.userService.createOrRefreshInviteLink(dto.personId);
  }

  @Get()
  @ApiOperation({ summary: 'Llistar usuaris' })
  @ApiResponse({ status: 200, description: "Llista d'usuaris" })
  findAll(
    @Query() filters: UserFilterDto,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    return this.userService.findAll(filters);
  }

  @Get('devices-summary')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Llista els usuaris amb sessions, dispositius, darrer accés i invitació' })
  @ApiResponse({ status: 200, description: 'Resum paginat per usuari' })
  devicesSummary(
    @Query() filters: UserDevicesFilterDto,
  ): Promise<{ data: UserDevicesSummary[]; meta: { total: number; page: number; limit: number } }> {
    return this.userService.findDevicesSummary(filters);
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

  @Get(':id/sessions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Llista les sessions obertes d'un usuari" })
  @ApiResponse({ status: 200, description: 'Sessions obertes (una per família de refresh token)' })
  listSessions(@Param('id', ParseUUIDPipe) id: string): Promise<UserSession[]> {
    return this.tokenService.listActiveSessions(id);
  }

  @Delete(':id/sessions/:family')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Fa expirar una sessió d'un usuari" })
  @ApiResponse({ status: 204, description: 'Sessió revocada' })
  @ApiResponse({ status: 404, description: 'La sessió no existeix o no és de l\'usuari' })
  async revokeSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('family', ParseUUIDPipe) family: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    if ((await this.tokenService.revokeFamily(id, family)) === 0) {
      throw new NotFoundException('Sessió no trobada');
    }
    await this.auditService.record({
      actorUserId: actor.sub,
      action: AuditAction.USER_SESSIONS_REVOKED,
      targetType: 'User',
      targetId: id,
      metadata: { family },
    });
  }

  @Delete(':id/sessions')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Fa expirar totes les sessions d'un usuari" })
  @ApiResponse({ status: 204, description: 'Sessions revocades' })
  async revokeAllSessions(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    await this.tokenService.revokeAllUserTokens(id);
    await this.auditService.record({
      actorUserId: actor.sub,
      action: AuditAction.USER_SESSIONS_REVOKED,
      targetType: 'User',
      targetId: id,
      metadata: { family: 'all' },
    });
  }

  @Get(':id/push-subscriptions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: "Llista els dispositius subscrits a push d'un usuari" })
  listPushDevices(@Param('id', ParseUUIDPipe) id: string): Promise<UserPushDevice[]> {
    return this.pushSubscriptionService.listActiveForUser(id);
  }

  @Delete(':id/push-subscriptions/:subId')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Elimina una subscripció push d'un usuari" })
  @ApiResponse({ status: 204, description: 'Subscripció eliminada' })
  @ApiResponse({ status: 404, description: 'La subscripció no existeix o no és de l\'usuari' })
  async removePushDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<void> {
    if (!(await this.pushSubscriptionService.deactivateForUser(id, subId))) {
      throw new NotFoundException('Subscripció no trobada');
    }
    await this.auditService.record({
      actorUserId: actor.sub,
      action: AuditAction.PUSH_SUBSCRIPTION_REMOVED,
      targetType: 'User',
      targetId: id,
      metadata: { subscriptionId: subId },
    });
  }

  @Post(':id/push-subscriptions/:subId/test')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envia una notificació de prova a un dispositiu' })
  @ApiResponse({ status: 200, description: 'Resultat de l\'enviament (gone: la subscripció ja no existeix)' })
  @ApiResponse({ status: 404, description: 'La subscripció no existeix o no és de l\'usuari' })
  async testPushDevice(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('subId', ParseUUIDPipe) subId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<{ success: boolean; gone: boolean }> {
    const result = await this.pushSubscriptionService.sendTest(id, subId);
    if (!result) throw new NotFoundException('Subscripció no trobada');
    await this.auditService.record({
      actorUserId: actor.sub,
      action: AuditAction.PUSH_SUBSCRIPTION_TESTED,
      targetType: 'User',
      targetId: id,
      metadata: { subscriptionId: subId, success: result.success },
    });
    return result;
  }
}
