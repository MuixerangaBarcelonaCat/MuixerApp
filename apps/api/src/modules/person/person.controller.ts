import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonService } from './person.service';
import { CreatePersonDto } from './dto/create-person.dto';
import { CreateProvisionalPersonDto } from './dto/create-provisional-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';

@ApiTags('persons')
@Controller('persons')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class PersonController {
  constructor(private readonly personService: PersonService) {}

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

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un membre per ID' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre trobat' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
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
    return this.personService.createProvisional(dto.alias);
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

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar un membre manualment' })
  @ApiParam({ name: 'id', description: 'UUID del membre' })
  @ApiResponse({ status: 200, description: 'Membre desactivat correctament' })
  @ApiResponse({ status: 404, description: 'Membre no trobat' })
  async deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.personService.deactivate(id);
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
