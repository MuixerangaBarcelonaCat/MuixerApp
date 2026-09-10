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
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import { JwtPayload, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PersonDelegateService } from './person-delegate.service';
import { CreatePersonDelegateDto } from './dto/create-person-delegate.dto';
import { UpdatePersonDelegateDto } from './dto/update-person-delegate.dto';
import {
  AdminPersonDelegateResponseDto,
  PersonDelegateResponseDto,
} from './dto/person-delegate-response.dto';
import { DelegationCandidateResponseDto } from './dto/delegation-candidate-response.dto';

@ApiTags('person-delegates')
@ApiBearerAuth()
@Controller('persons/:personId/delegates')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class PersonDelegateController {
  constructor(private readonly delegateService: PersonDelegateService) {}

  @Get()
  @ApiOperation({ summary: 'Llistar delegats d\'una persona' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  @ApiResponse({ status: 200, description: 'Llista de delegats' })
  async findAll(
    @Param('personId', ParseUUIDPipe) personId: string,
    @CurrentUser() actor: JwtPayload,
  ): Promise<(PersonDelegateResponseDto | AdminPersonDelegateResponseDto)[]> {
    const delegates = await this.delegateService.findByPerson(personId);
    const responseType =
      actor.role === UserRole.ADMIN
        ? AdminPersonDelegateResponseDto
        : PersonDelegateResponseDto;
    return plainToInstance(responseType, delegates, {
      excludeExtraneousValues: true,
    });
  }

  @Get('candidates')
  @ApiOperation({ summary: 'Cercar candidats per a delegar una persona' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  async findCandidates(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Query('search') search?: string,
  ): Promise<DelegationCandidateResponseDto[]> {
    const candidates = await this.delegateService.findCandidates(personId, search);
    return plainToInstance(DelegationCandidateResponseDto, candidates, {
      excludeExtraneousValues: true,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Afegir un delegat a una persona' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  @ApiResponse({ status: 201, description: 'Delegat creat' })
  @ApiResponse({ status: 400, description: 'Autodelegació o dades invàlides' })
  @ApiResponse({ status: 404, description: 'Persona o usuari no trobat' })
  @ApiResponse({ status: 409, description: 'Delegació ja existent' })
  async create(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: CreatePersonDelegateDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<PersonDelegateResponseDto | AdminPersonDelegateResponseDto> {
    const delegate = await this.delegateService.create(personId, dto);
    const responseType =
      actor.role === UserRole.ADMIN
        ? AdminPersonDelegateResponseDto
        : PersonDelegateResponseDto;
    return plainToInstance(responseType, delegate, {
      excludeExtraneousValues: true,
    });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar tipus o estat d\'un delegat' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  @ApiParam({ name: 'id', description: 'UUID del delegat' })
  @ApiResponse({ status: 200, description: 'Delegat actualitzat' })
  @ApiResponse({ status: 404, description: 'Delegat no trobat' })
  async update(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePersonDelegateDto,
    @CurrentUser() actor: JwtPayload,
  ): Promise<PersonDelegateResponseDto | AdminPersonDelegateResponseDto> {
    const delegate = await this.delegateService.update(personId, id, dto);
    const responseType =
      actor.role === UserRole.ADMIN
        ? AdminPersonDelegateResponseDto
        : PersonDelegateResponseDto;
    return plainToInstance(responseType, delegate, {
      excludeExtraneousValues: true,
    });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un delegat' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  @ApiParam({ name: 'id', description: 'UUID del delegat' })
  @ApiResponse({ status: 204, description: 'Delegat eliminat' })
  @ApiResponse({ status: 404, description: 'Delegat no trobat' })
  remove(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.delegateService.remove(personId, id);
  }
}
