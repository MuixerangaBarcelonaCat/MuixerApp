import { Controller, Get, Post, Patch, Delete, Param, Body, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
import { UpdateNewsDto } from './dto/update-news.dto';

@ApiTags('news')
@ApiBearerAuth()
@Controller('news')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class NewsController {
  constructor(private readonly newsService: NewsService) {}

  @Get()
  @ApiOperation({ summary: 'Llistar totes les notícies' })
  @ApiResponse({ status: 200, description: 'Llista de notícies retornada correctament.' })
  findAll() {
    return this.newsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir el detall d\'una notícia' })
  @ApiResponse({ status: 200, description: 'Notícia retornada correctament.' })
  @ApiResponse({ status: 404, description: 'Notícia no trobada.' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.newsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear una nova notícia' })
  @ApiResponse({ status: 201, description: 'Notícia creada correctament.' })
  @ApiResponse({ status: 400, description: 'Dades de la notícia invàlides.' })
  create(@Body() createNewsDto: CreateNewsDto) {
    return this.newsService.create(createNewsDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar una notícia' })
  @ApiResponse({ status: 200, description: 'Notícia actualitzada correctament.' })
  @ApiResponse({ status: 404, description: 'Notícia no trobada.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateNewsDto: UpdateNewsDto,
  ) {
    return this.newsService.update(id, updateNewsDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar una notícia' })
  @ApiResponse({ status: 204, description: 'Notícia eliminada correctament.' })
  @ApiResponse({ status: 404, description: 'Notícia no trobada.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.newsService.remove(id);
  }
}
