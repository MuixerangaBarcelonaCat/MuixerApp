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
import { EventType } from '@muixer/shared';
import {
  EVENT_SORT_BY_FIELDS,
  EVENT_SORT_ORDER_VALUES,
  EVENT_TIME_FILTER_VALUES,
} from '../constants/event-sort.constants';

export class EventFilterDto {
  @IsOptional()
  @IsUUID('4')
  seasonId?: string;

  @IsOptional()
  @IsEnum(EventType)
  eventType?: EventType;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  countsForStatistics?: boolean;

  @IsOptional()
  @IsIn(EVENT_SORT_BY_FIELDS)
  sortBy?: (typeof EVENT_SORT_BY_FIELDS)[number];

  @IsOptional()
  @IsIn(EVENT_SORT_ORDER_VALUES)
  sortOrder?: (typeof EVENT_SORT_ORDER_VALUES)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;

  @IsOptional()
  @IsIn(EVENT_TIME_FILTER_VALUES)
  timeFilter?: (typeof EVENT_TIME_FILTER_VALUES)[number];
}
