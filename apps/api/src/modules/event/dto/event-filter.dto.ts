import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsUUID,
  IsIn,
  IsDateString,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventType } from '@muixer/shared';
import {
  EVENT_SORT_BY_FIELDS,
  EVENT_SORT_ORDER_VALUES,
  EVENT_TIME_FILTER_VALUES,
} from '../constants/event-sort.constants';

export class EventFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar per UUID de temporada' })
  @IsOptional()
  @IsUUID('4')
  seasonId?: string;

  @ApiPropertyOptional({ description: 'Filtrar per tipus d\'event', enum: EventType })
  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @ApiPropertyOptional({ description: 'Data d\'inici del rang de filtrat (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Data de fi del rang de filtrat (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Cerca per títol o ubicació de l\'event' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar per si l\'event compta per estadístiques' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  countsForStatistics?: boolean;

  @ApiPropertyOptional({ description: 'Camp d\'ordenació', enum: EVENT_SORT_BY_FIELDS })
  @IsOptional()
  @IsIn(EVENT_SORT_BY_FIELDS)
  sortBy?: (typeof EVENT_SORT_BY_FIELDS)[number];

  @ApiPropertyOptional({ description: 'Ordre d\'ordenació', enum: EVENT_SORT_ORDER_VALUES })
  @IsOptional()
  @IsIn(EVENT_SORT_ORDER_VALUES)
  sortOrder?: (typeof EVENT_SORT_ORDER_VALUES)[number];

  @ApiPropertyOptional({ description: 'Número de pàgina (comença a 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Nombre de resultats per pàgina (màx. 100)', default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @ApiPropertyOptional({ description: 'Filtre de temps: "upcoming" (futurs), "past" (passats) o tots', enum: EVENT_TIME_FILTER_VALUES })
  @IsOptional()
  @IsIn(EVENT_TIME_FILTER_VALUES)
  timeFilter?: (typeof EVENT_TIME_FILTER_VALUES)[number];
}
