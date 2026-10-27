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
} from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AuditAction, JwtPayload, ShirtCandidate, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuditService } from '../audit/audit.service';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateProvisionalPersonDto } from './dto/create-provisional-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';

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
  async findAll(@Query() filters: PersonFilterDto) {
    const { data, total } = await this.personService.findAll(filters);
    return {
      data,
      meta: {
        total,
        page: filters.page || 1,
        limit: filters.limit || 50,
      },
    };
  }

  // Declarat abans de `:id`: Nest resol les rutes en ordre de declaració.
  @Get('shirt-candidates')
  @ApiOperation({
    summary: 'Persones pendents de camisa',
    description:
      'Persones actives i no provisionals sense data de camisa, amb les actuacions i assajos amb ' +
      'assistència marcada (de tota la història, només esdeveniments que compten per a ' +
      'estadístiques). Primer qui ja hi té dret; després, de més a menys a prop.',
  })
  @ApiResponse({ status: 200, description: 'Llista de candidats (sense paginar)' })
  findShirtCandidates(): Promise<ShirtCandidate[]> {
    return this.personService.findShirtCandidates();
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
  ) {
    // GDPR: reading a person's detail exposes PII — log the access for auditing.
    await this.auditService.record({
      actorUserId: user.sub,
      action: AuditAction.SENSITIVE_DATA_ACCESS,
      targetType: 'Person',
      targetId: id,
      ipAddress: req.ip ?? null,
    });
    return this.personService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un nou membre' })
  @ApiResponse({ status: 201, description: 'Membre creat correctament' })
  @ApiResponse({ status: 400, description: 'Dades invàlides' })
  create(@Body() createPersonDto: CreatePersonDto) {
    return this.personService.create(createPersonDto);
  }

  @Post('provisional')
  @ApiOperation({ summary: 'Crear una persona provisional (només àlies requerit)' })
  @ApiResponse({ status: 201, description: 'Persona provisional creada' })
  @ApiResponse({ status: 400, description: 'Àlies invàlid' })
  @ApiResponse({ status: 409, description: 'Àlies ja en ús' })
  createProvisional(@Body() dto: CreateProvisionalPersonDto) {
    return this.personService.createProvisional(dto.alias, dto.isXicalla ?? false);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar un membre' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre actualitzat' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePersonDto: UpdatePersonDto,
  ) {
    return this.personService.update(id, updatePersonDto);
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
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.personService.activate(id);
  }
}
