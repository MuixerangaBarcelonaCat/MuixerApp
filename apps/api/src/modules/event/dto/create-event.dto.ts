import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsUUID,
  IsDateString,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@muixer/shared';

export class CreateEventDto {
  @ApiProperty({ description: 'Títol de l\'esdeveniment', maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @ApiProperty({ description: 'Tipus d\'esdeveniment', enum: EventType })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ description: 'Data de l\'esdeveniment (ISO 8601)', example: '2026-05-10' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ description: 'Hora d\'inici (HH:mm)', example: '19:00' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;

  @ApiPropertyOptional({ description: 'Lloc de l\'esdeveniment', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @ApiPropertyOptional({ description: 'URL de la ubicació' })
  @IsOptional()
  @IsUrl({}, { message: 'locationUrl must be a valid URL' })
  locationUrl?: string;

  @ApiPropertyOptional({ description: 'Descripció de l\'esdeveniment' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Informació addicional' })
  @IsOptional()
  @IsString()
  information?: string;

  @ApiPropertyOptional({ description: 'Compta per a estadístiques', default: true })
  @IsOptional()
  @IsBoolean()
  countsForStatistics?: boolean;

  @ApiPropertyOptional({ description: 'UUID de la temporada associada' })
  @IsOptional()
  @IsUUID('4')
  seasonId?: string;
}
