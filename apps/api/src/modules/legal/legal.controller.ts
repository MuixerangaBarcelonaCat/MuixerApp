import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { LegalDocumentType, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { LegalDocumentService } from './legal-document.service';
import { PublishLegalDocumentDto } from './dto/publish-legal-document.dto';

@ApiTags('legal')
@ApiBearerAuth()
@Controller('legal')
export class LegalController {
  constructor(private readonly legalService: LegalDocumentService) {}

  @Get('documents')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Llistar tots els documents legals i les seves versions' })
  @ApiResponse({ status: 200, description: 'Llista de documents legals.' })
  findAll() {
    return this.legalService.findAll();
  }

  // No @Roles: any authenticated user may read the active document (consent modal, forms).
  @Get(':type/active')
  @ApiOperation({ summary: 'Obtenir la versió activa d\'un document legal' })
  @ApiParam({ name: 'type', enum: LegalDocumentType })
  @ApiResponse({ status: 200, description: 'Document actiu retornat correctament.' })
  @ApiResponse({ status: 404, description: 'No hi ha cap document actiu d\'aquest tipus.' })
  findActive(@Param('type', new ParseEnumPipe(LegalDocumentType)) type: LegalDocumentType) {
    return this.legalService.findActive(type);
  }

  @Post('documents')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Publicar una versió nova d\'un document legal' })
  @ApiResponse({ status: 201, description: 'Nova versió publicada i activada.' })
  @ApiResponse({ status: 400, description: 'Dades invàlides.' })
  publish(@Body() dto: PublishLegalDocumentDto) {
    return this.legalService.publish(dto);
  }
}
