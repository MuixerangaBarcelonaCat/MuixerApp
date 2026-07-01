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
import { CompositionService } from './composition.service';
import { CreateCompositionDto } from './dto/create-composition.dto';
import { UpdateCompositionDto } from './dto/update-composition.dto';
import { CompositionFilterDto } from './dto/composition-filter.dto';

@ApiTags('compositions')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('compositions')
export class CompositionController {
  constructor(private readonly compositionService: CompositionService) {}

  @ApiOperation({ summary: 'List all compositions (paginated)' })
  @Get()
  findAll(@Query() filter: CompositionFilterDto) {
    return this.compositionService.findAll(filter);
  }

  @ApiOperation({ summary: 'Get a composition with entries and figure nodes' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.compositionService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new composition' })
  @Post()
  create(@Body() dto: CreateCompositionDto) {
    return this.compositionService.create(dto);
  }

  @ApiOperation({ summary: 'Update a composition (entries fully replaced)' })
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCompositionDto,
  ) {
    return this.compositionService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a composition' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.compositionService.remove(id);
  }

  @ApiOperation({ summary: 'Duplicate a composition (appends " - còpia" to name)' })
  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string) {
    return this.compositionService.duplicate(id);
  }
}
