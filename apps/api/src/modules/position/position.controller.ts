import { Controller, Get, Post, Patch, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { PositionService } from './position.service';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@ApiTags('positions')
@ApiBearerAuth()
@Controller('positions')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class PositionController {
  constructor(private readonly positionService: PositionService) {}

  /** Llista totes les posicions muixerangueres disponibles. */
  @Get()
  @ApiOperation({ summary: 'Llistar totes les posicions' })
  @ApiResponse({ status: 200, description: 'Llista de posicions retornada correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  findAll() {
    return this.positionService.findAll();
  }

  /** Retorna el detall d'una posició per ID. */
  @Get(':id')
  @ApiOperation({ summary: 'Obtenir el detall d\'una posició' })
  @ApiResponse({ status: 200, description: 'Posició retornada correctament.' })
  @ApiResponse({ status: 404, description: 'Posició no trobada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.positionService.findOne(id);
  }

  /** Crea una nova posició muixeranguera. */
  @Post()
  @ApiOperation({ summary: 'Crear una nova posició' })
  @ApiResponse({ status: 201, description: 'Posició creada correctament.' })
  @ApiResponse({ status: 400, description: 'Dades de la posició invàlides.' })
  create(@Body() createPositionDto: CreatePositionDto) {
    return this.positionService.create(createPositionDto);
  }

  /** Actualitza parcialment una posició existent. */
  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar una posició' })
  @ApiResponse({ status: 200, description: 'Posició actualitzada correctament.' })
  @ApiResponse({ status: 404, description: 'Posició no trobada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updatePositionDto: UpdatePositionDto,
  ) {
    return this.positionService.update(id, updatePositionDto);
  }
}
