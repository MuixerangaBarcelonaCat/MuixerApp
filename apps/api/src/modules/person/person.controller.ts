import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuditAction, JwtPayload, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateProvisionalPersonDto } from './dto/create-provisional-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';
import {
  AdminPersonDetailDto,
  AdminPersonListItemDto,
  OperationalPersonDetailDto,
  TechnicalPersonDirectoryItemDto,
  toAdminPersonDetail,
  toAdminPersonListItem,
  toOperationalPersonDetail,
  toTechnicalPersonDirectoryItem,
} from './dto/person-response.dto';
import { canTechnicalUpdatePerson } from './policies/technical-person-update.policy';

@ApiTags('persons')
@ApiBearerAuth()
@Controller('persons')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class PersonController {
  constructor(
    private readonly personService: PersonService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Llistar membres amb filtres i paginació' })
  @ApiResponse({ status: 200, description: 'Llista de membres' })
  async findAll(
    @Query() filters: PersonFilterDto,
    @CurrentUser() user: JwtPayload,
    @Req() req?: Request,
  ): Promise<{
    data: (TechnicalPersonDirectoryItemDto | AdminPersonListItemDto)[];
    meta: { total: number; page: number; limit: number };
  }> {
    const { data, total } = await this.personService.findAll(filters, user.role);
    const responseData =
      user.role === UserRole.ADMIN
        ? data.map(toAdminPersonListItem)
        : data.map(toTechnicalPersonDirectoryItem);
    if (user.role === UserRole.ADMIN) {
      await this.auditService.record({
        actorUserId: user.sub,
        action: AuditAction.SENSITIVE_DATA_ACCESS,
        targetType: 'Person',
        metadata: {
          role: user.role,
          route: '/persons',
          page: filters.page || 1,
          resultCount: responseData.length,
        },
        ipAddress: req?.ip ?? null,
      });
    }
    return {
      data: responseData,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 50,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un membre per ID' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre trobat' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<OperationalPersonDetailDto | AdminPersonDetailDto> {
    const person = await this.personService.findOne(id, user.role);
    await this.auditService.record({
      actorUserId: user.sub,
      action: AuditAction.SENSITIVE_DATA_ACCESS,
      targetType: 'Person',
      targetId: id,
      metadata: {
        scope: user.role === UserRole.ADMIN ? 'protected' : 'operational',
      },
      ipAddress: req.ip ?? null,
    });
    return user.role === UserRole.ADMIN
      ? toAdminPersonDetail(person)
      : toOperationalPersonDetail(person);
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Crear un nou membre' })
  @ApiResponse({ status: 201, description: 'Membre creat correctament' })
  @ApiResponse({ status: 400, description: 'Dades invàlides' })
  async create(@Body() createPersonDto: CreatePersonDto): Promise<AdminPersonDetailDto> {
    const person = await this.personService.create(createPersonDto);
    return toAdminPersonDetail(person);
  }

  @Post('provisional')
  @ApiOperation({ summary: 'Crear una persona provisional (només àlies requerit)' })
  @ApiResponse({ status: 201, description: 'Persona provisional creada' })
  @ApiResponse({ status: 400, description: 'Àlies invàlid' })
  @ApiResponse({ status: 409, description: 'Àlies ja en ús' })
  async createProvisional(
    @Body() dto: CreateProvisionalPersonDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OperationalPersonDetailDto | AdminPersonDetailDto> {
    const person = await this.personService.createProvisional(dto.alias);
    return user.role === UserRole.ADMIN
      ? toAdminPersonDetail(person)
      : toOperationalPersonDetail(person);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar un membre' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre actualitzat' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<OperationalPersonDetailDto | AdminPersonDetailDto> {
    if (
      user.role === UserRole.TECHNICAL &&
      !canTechnicalUpdatePerson(updatePersonDto)
    ) {
      throw new ForbiddenException(
        'No teniu permís per modificar aquestes dades personals',
      );
    }

    const person = await this.personService.update(id, updatePersonDto);
    return user.role === UserRole.ADMIN
      ? toAdminPersonDetail(person)
      : toOperationalPersonDetail(person);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un membre (soft delete)' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 204, description: 'Membre eliminat' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.personService.softDelete(id);
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activar un membre manualment' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre activat correctament' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  async activate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<OperationalPersonDetailDto | AdminPersonDetailDto> {
    const person = await this.personService.activate(id);
    return user.role === UserRole.ADMIN
      ? toAdminPersonDetail(person)
      : toOperationalPersonDetail(person);
  }
}
