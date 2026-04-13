import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsUUID, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { AvailabilityStatus } from '@muixer/shared';
import { PERSON_SORT_BY_FIELDS, PERSON_SORT_ORDER_VALUES } from '../constants/person-sort.constants';

export class PersonFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsUUID('4', { each: true })
  positionIds?: string[];

  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availability?: AvailabilityStatus;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isXicalla?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isMember?: boolean;

  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  isProvisional?: boolean;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @IsIn(PERSON_SORT_BY_FIELDS)
  @IsOptional()
  sortBy?: (typeof PERSON_SORT_BY_FIELDS)[number];

  @IsIn(PERSON_SORT_ORDER_VALUES)
  @IsOptional()
  @Type(() => String)
  sortOrder?: (typeof PERSON_SORT_ORDER_VALUES)[number];
}
