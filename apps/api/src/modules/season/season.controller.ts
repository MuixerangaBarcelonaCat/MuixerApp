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
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { SeasonService } from './season.service';
import { CreateSeasonDto } from './dto/create-season.dto';
import { UpdateSeasonDto } from './dto/update-season.dto';
import { SeasonMutationQueryDto } from './dto/season-mutation-query.dto';

@ApiTags('seasons')
@ApiBearerAuth()
@Controller('seasons')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class SeasonController {
  constructor(private readonly seasonService: SeasonService) {}

  @Get()
  @ApiOperation({ summary: 'Llistar temporades amb comptador d\'esdeveniments' })
  @ApiResponse({ status: 200, description: 'Llista de temporades' })
  async findAll() {
    const { data, total } = await this.seasonService.findAll();
    return {
      data,
      meta: { total, page: 1, limit: 25 },
    };
  }

  @Get('current')
  @ApiOperation({ summary: 'Obtenir la temporada actual (per rang de dates)' })
  @ApiResponse({ status: 200, description: 'Temporada actual' })
  @ApiResponse({ status: 404, description: 'Cap temporada trobada' })
  findCurrent() {
    return this.seasonService.findCurrent();
  }

  @Get('uncovered-events')
  @ApiOperation({ summary: 'Comptar els esdeveniments la data dels quals no és dins de cap temporada' })
  @ApiResponse({ status: 200, description: '{ count }' })
  countUncoveredEvents() {
    return this.seasonService.countUncoveredEvents();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir una temporada per ID' })
  @ApiParam({ name: 'id', description: 'UUID de la temporada' })
  @ApiResponse({ status: 200, description: 'Temporada trobada' })
  @ApiResponse({ status: 404, description: 'Temporada no trobada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nova temporada' })
  @ApiResponse({ status: 201, description: 'Temporada creada' })
  @ApiResponse({ status: 409, description: 'Nom duplicat o dates se solapen' })
  create(@Body() dto: CreateSeasonDto) {
    return this.seasonService.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar una temporada' })
  @ApiParam({ name: 'id', description: 'UUID de la temporada' })
  @ApiResponse({ status: 200, description: 'Temporada actualitzada' })
  @ApiResponse({ status: 404, description: 'Temporada no trobada' })
  @ApiResponse({
    status: 409,
    description:
      'Nom duplicat, dates que se solapen, o esdeveniments que quedarien sense temporada ' +
      '(`code: SEASON_LEAVES_EVENTS_UNCOVERED`; torneu a enviar-ho amb `allowUncovered=true`)',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSeasonDto,
    @Query() query: SeasonMutationQueryDto,
  ) {
    return this.seasonService.update(id, dto, { allowUncovered: query.allowUncovered });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una temporada' })
  @ApiParam({ name: 'id', description: 'UUID de la temporada' })
  @ApiResponse({ status: 204, description: 'Temporada eliminada' })
  @ApiResponse({ status: 404, description: 'Temporada no trobada' })
  @ApiResponse({
    status: 409,
    description:
      'Té esdeveniments que quedarien sense temporada (`code: SEASON_LEAVES_EVENTS_UNCOVERED`; ' +
      'torneu a enviar-ho amb `allowUncovered=true`)',
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @Query() query: SeasonMutationQueryDto) {
    return this.seasonService.remove(id, { allowUncovered: query.allowUncovered });
  }
}
