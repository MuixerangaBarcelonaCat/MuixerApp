import {
  Controller,
  Post,
  Body
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserService} from './user.service';
import { CreateWithInviteDto } from './dto/create-with-invite.dto';

@ApiTags('users')
@Controller('users')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('create-with-invite')
  @ApiOperation({
    summary: "Crea un usuari per una persona i envia email d'invitació",
  })
  @ApiResponse({ status: 201, description: 'Usuari creat i convidat' })
  createWithInvite(@Body() dto: CreateWithInviteDto) {
    return this.userService.createWithInvite(dto);
  }
}