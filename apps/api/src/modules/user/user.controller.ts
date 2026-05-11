import { Controller, Get, Patch, Post, Body, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserService} from './user.service';
import { CreateWithInviteDto } from './dto/create-with-invite.dto';
import { UserFilterDto } from './dto/user-filter.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { GrantUserRoleDto } from './dto/grant-user-role.dto';
import { UpdatePersonDto } from '../person/dto/update-person.dto';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.ADMIN, UserRole.TECHNICAL)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create-with-invite')
  @ApiOperation({
    summary: "Crea un usuari per una persona i envia email d'invitació",
  })
  @ApiResponse({ status: 201, description: 'Usuari creat i convidat' })
  @ApiResponse({ status: 400, description: "Error en crear l'usuari" })
  createWithInvite(@Body() dto: CreateWithInviteDto) {
    return this.userService.createWithInvite(dto);
  }

  @Get('/')
  @ApiOperation({
    summary: 'Llistar usuaris',
  })
  @ApiResponse({ status: 200, description: "Llista d'usuaris" })
  @Get()
  findAll(
    @Query() filters: UserFilterDto,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    return this.userService.findAll(filters);
  }

  @Patch('/:id/role')
  @ApiOperation({
    summary: 'Assigna un rol a un usuari',
  })
  @Roles(UserRole.ADMIN)
  @ApiResponse({ status: 200, description: 'Usuari actualitzat' })
  @ApiResponse({ status: 400, description: 'Error en assignar el rol' })
  @ApiResponse({ status: 404, description: 'Usuari no trobat' })
  grantRole(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantUserRoleDto): Promise<UserResponseDto> {
    return this.userService.grantRole(id, dto.role);
  }
}