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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserService } from './user.service';
import { CreateWithInviteDto } from './dto/create-with-invite.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GrantUserRoleDto } from './dto/grant-user-role.dto';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN, UserRole.TECHNICAL)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: 'Crea un usuari TECHNICAL/ADMIN amb contrasenya' })
  @ApiResponse({ status: 201, description: 'Usuari creat correctament' })
  @ApiResponse({ status: 400, description: 'Dades invàlides' })
  @ApiResponse({ status: 409, description: 'Email ja existeix' })
  createUser(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.userService.createUser(dto);
  }

  @Post('create-with-invite')
  @ApiOperation({
    summary: "Crea un usuari per una persona i envia email d'invitació",
  })
  @ApiResponse({ status: 201, description: 'Usuari creat i convidat' })
  @ApiResponse({ status: 400, description: "Error en crear l'usuari" })
  createWithInvite(@Body() dto: CreateWithInviteDto) {
    return this.userService.createWithInvite(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Llistar usuaris' })
  @ApiResponse({ status: 200, description: "Llista d'usuaris" })
  findAll(
    @Query() filters: UserFilterDto,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    return this.userService.findAll(filters);
  }

  @Patch('grant-role')
  @ApiOperation({ summary: 'Assigna un rol a un usuari' })
  @Roles(UserRole.ADMIN)
  @ApiResponse({ status: 200, description: 'Usuari actualitzat' })
  @ApiResponse({ status: 400, description: 'Error en assignar el rol' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  grantRole(@Body() dto: GrantUserRoleDto): Promise<UserResponseDto> {
    return this.userService.grantRole(dto.userId, dto.role);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desactiva un usuari' })
  @ApiResponse({ status: 204, description: 'Usuari desactivat' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.userService.deactivateUser(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: "Actualitza les dades d'un usuari" })
  @ApiResponse({ status: 200, description: 'Usuari actualitzat' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  @ApiResponse({ status: 409, description: 'Email ja existeix' })
  updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return this.userService.updateUser(id, dto);
  }
}