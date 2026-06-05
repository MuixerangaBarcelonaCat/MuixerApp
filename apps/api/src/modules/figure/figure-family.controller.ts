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
import { FigureFamilyService } from './figure-family.service';
import { CreateFigureFamilyDto } from './dto/create-figure-family.dto';
import { UpdateFigureFamilyDto } from './dto/update-figure-family.dto';
import { FigureFamilyFilterDto } from './dto/figure-family-filter.dto';

@ApiTags('figure-families')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('figure-families')
export class FigureFamilyController {
  constructor(private readonly figureFamilyService: FigureFamilyService) {}

  @ApiOperation({ summary: 'List figure families with optional search and pagination. Pass includeVariants=true to get full detail with variants in one request.' })
  @Get()
  async findAll(@Query() filters: FigureFamilyFilterDto) {
    const { data, total } = await this.figureFamilyService.findAll(filters);
    return {
      data,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      },
    };
  }

  @ApiOperation({ summary: 'Get a figure family by ID with all variants' })
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.figureFamilyService.findOne(id);
  }

  @ApiOperation({ summary: 'Create a new figure family' })
  @Post()
  create(@Body() dto: CreateFigureFamilyDto) {
    return this.figureFamilyService.create(dto);
  }

  @ApiOperation({ summary: 'Update a figure family' })
  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFigureFamilyDto,
  ) {
    return this.figureFamilyService.update(id, dto);
  }

  @ApiOperation({ summary: 'Delete a figure family (blocked if has variants)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.figureFamilyService.remove(id);
  }
}
