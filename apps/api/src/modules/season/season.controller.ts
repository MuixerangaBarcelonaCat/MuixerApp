import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { SeasonService } from './season.service';

@ApiTags('seasons')
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

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir una temporada per ID' })
  @ApiParam({ name: 'id', description: 'UUID de la temporada' })
  @ApiResponse({ status: 200, description: 'Temporada trobada' })
  @ApiResponse({ status: 404, description: 'Temporada no trobada' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.seasonService.findOne(id);
  }
}
