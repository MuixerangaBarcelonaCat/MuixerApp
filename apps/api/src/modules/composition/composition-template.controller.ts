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
import { CompositionTemplateService } from './composition-template.service';
import { CreateCompositionTemplateDto } from './dto/create-composition-template.dto';
import { UpdateCompositionTemplateDto } from './dto/update-composition-template.dto';
import { CompositionTemplateFilterDto } from './dto/composition-template-filter.dto';

@ApiTags('composition-templates')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('composition-templates')
export class CompositionTemplateController {
  constructor(
    private readonly compositionTemplateService: CompositionTemplateService,
  ) {}

  @ApiOperation({ summary: 'List composition templates with optional search and pagination' })
  @Get()
  async findAll(@Query() filters: CompositionTemplateFilterDto) {
    const { data, total } = await this.compositionTemplateService.findAll(filters);
    return {
      data,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      },
    };
  }

  @ApiOperation({ summary: 'Get a composition template by ID with all slots and figure nodes' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.compositionTemplateService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new composition template with inline slots' })
  @Post()
  create(@Body() dto: CreateCompositionTemplateDto) {
    return this.compositionTemplateService.create(dto);
  }

  @ApiOperation({ summary: 'Update a composition template. Slots list is fully replaced if provided.' })
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompositionTemplateDto,
  ) {
    return this.compositionTemplateService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a composition template (cascade deletes slots)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.compositionTemplateService.remove(id);
  }

  @ApiOperation({ summary: 'Duplicate a composition template with all its slots' })
  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.compositionTemplateService.duplicate(id);
  }
}
