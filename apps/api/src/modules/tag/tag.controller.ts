import { Controller, Get, Post, Patch, Delete, Param, Body, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagFilterDto } from './dto/tag-filter.dto';
import { AssignPersonsDto } from './dto/assign-persons.dto';

@ApiTags('tags')
@ApiBearerAuth()
@Controller('tags')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class TagController {
  constructor(private readonly tagService: TagService) {}

  @Get()
  @ApiOperation({ summary: 'Llistar totes les etiquetes' })
  @ApiResponse({ status: 200, description: 'Llista d\'etiquetes retornada correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  findAll(@Query() filter: TagFilterDto) {
    return this.tagService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir el detall d\'una etiqueta' })
  @ApiResponse({ status: 200, description: 'Etiqueta retornada correctament.' })
  @ApiResponse({ status: 404, description: 'Etiqueta no trobada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.tagService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nova etiqueta' })
  @ApiResponse({ status: 201, description: 'Etiqueta creada correctament.' })
  @ApiResponse({ status: 400, description: 'Dades de l\'etiqueta invàlides.' })
  create(@Body() createTagDto: CreateTagDto) {
    return this.tagService.create(createTagDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar una etiqueta' })
  @ApiResponse({ status: 200, description: 'Etiqueta actualitzada correctament.' })
  @ApiResponse({ status: 404, description: 'Etiqueta no trobada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTagDto: UpdateTagDto,
  ) {
    return this.tagService.update(id, updateTagDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una etiqueta' })
  @ApiResponse({ status: 204, description: 'Etiqueta eliminada correctament.' })
  @ApiResponse({ status: 404, description: 'Etiqueta no trobada.' })
  @ApiResponse({ status: 409, description: 'No es pot esborrar: hi ha persones amb aquesta etiqueta assignada.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tagService.remove(id);
  }

  @Post(':id/persons')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Assignar una o més persones a una etiqueta" })
  @ApiResponse({ status: 204, description: 'Persones assignades correctament.' })
  @ApiResponse({ status: 404, description: "Etiqueta o alguna de les persones no trobada." })
  assignPersons(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() { personIds }: AssignPersonsDto,
  ): Promise<void> {
    return this.tagService.assignPersons(id, personIds);
  }

  @Delete(':id/persons/:personId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Treure una persona d'una etiqueta" })
  @ApiResponse({ status: 204, description: 'Persona treta correctament.' })
  @ApiResponse({ status: 404, description: 'Etiqueta no trobada.' })
  unassignPerson(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<void> {
    return this.tagService.unassignPerson(id, personId);
  }
}
