import { IsOptional, IsEnum, IsIn, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { EventType } from '@muixer/shared';

const TIME_FILTER_VALUES = ['upcoming', 'past', 'all'] as const;

export class MeEventFilterDto {
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @IsOptional()
  @IsIn(TIME_FILTER_VALUES)
  timeFilter?: (typeof TIME_FILTER_VALUES)[number] = 'upcoming';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
