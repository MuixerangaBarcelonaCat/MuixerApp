import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@muixer/shared';
import { FigureTemplateService } from './figure-template.service';
import { CreateFigureTemplateDto } from './dto/create-figure-template.dto';
import { UpdateFigureTemplateDto } from './dto/update-figure-template.dto';
import { FigureTemplateFilterDto } from './dto/figure-template-filter.dto';

@ApiTags('figure-templates')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('figure-templates')
export class FigureTemplateController {
  constructor(private readonly figureTemplateService: FigureTemplateService) {}

  @ApiOperation({ summary: 'List figure templates with optional search and pagination' })
  @Get()
  async findAll(@Query() filters: FigureTemplateFilterDto) {
    const { data, total } = await this.figureTemplateService.findAll(filters);
    return {
      data,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      },
    };
  }

  @ApiOperation({ summary: 'Get a figure template by ID with all nodes' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.figureTemplateService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new figure template with inline nodes' })
  @Post()
  create(@Body() dto: CreateFigureTemplateDto) {
    return this.figureTemplateService.create(dto);
  }

  @ApiOperation({ summary: 'Update a figure template. Nodes list is fully replaced if provided.' })
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFigureTemplateDto,
  ) {
    return this.figureTemplateService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a figure template (cascade deletes nodes)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.figureTemplateService.remove(id);
  }

  @ApiOperation({ summary: 'Duplicate a figure template with all its nodes' })
  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.figureTemplateService.duplicate(id);
  }
}
