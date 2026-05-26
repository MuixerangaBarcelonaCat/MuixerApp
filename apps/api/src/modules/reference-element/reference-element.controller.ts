import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@muixer/shared';
import { ReferenceElementService } from './reference-element.service';
import { ReferenceElement } from './entities/reference-element.entity';
import { CreateReferenceElementDto } from './dto/create-reference-element.dto';
import { UpdateReferenceElementDto } from './dto/update-reference-element.dto';
import { BatchUpdateReferenceElementsDto } from './dto/batch-update-reference-elements.dto';
import { ToggleVisibilityDto } from './dto/toggle-visibility.dto';

@ApiTags('reference-elements')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('events/:eventId/reference-elements')
export class ReferenceElementController {
  constructor(private readonly service: ReferenceElementService) {}

  @Get()
  async findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<{ data: ReferenceElement[] }> {
    const data = await this.service.findByEvent(eventId);
    return { data };
  }

  @Post()
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateReferenceElementDto,
  ): Promise<ReferenceElement> {
    return this.service.create(eventId, dto);
  }

  @Put('batch')
  @HttpCode(HttpStatus.NO_CONTENT)
  async batchUpdate(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: BatchUpdateReferenceElementsDto,
  ): Promise<void> {
    return this.service.batchUpdate(eventId, dto);
  }

  @Put(':id')
  async update(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReferenceElementDto,
  ): Promise<ReferenceElement> {
    return this.service.update(eventId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.service.remove(eventId, id);
  }

  @Put(':id/visibility')
  async toggleVisibility(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleVisibilityDto,
  ): Promise<ReferenceElement> {
    return this.service.toggleVisibility(eventId, id, dto);
  }
}
