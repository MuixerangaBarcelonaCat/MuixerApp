import { IsString, IsOptional, IsEnum, IsInt, Min, Max, IsUUID, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus } from '@muixer/shared';
import { PERSON_SORT_BY_FIELDS, PERSON_SORT_ORDER_VALUES } from '../constants/person-sort.constants';

const toBool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : undefined;

export class PersonFilterDto {
  @ApiPropertyOptional({ description: 'Cerca per àlies, nom o cognoms (insensible a accents)' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar per UUIDs de posicions (multi-valor)', type: [String] })
  @IsOptional()
  @Type(() => String)
  @Transform(({ value }) => (Array.isArray(value) ? value : value ? [value] : []))
  @IsUUID('4', { each: true })
  positionIds?: string[];

  @ApiPropertyOptional({ description: 'Filtrar per disponibilitat del membre', enum: AvailabilityStatus })
  @IsEnum(AvailabilityStatus)
  @IsOptional()
  availability?: AvailabilityStatus;

  @ApiPropertyOptional({ description: 'Filtrar per membres actius (true) o inactius (false)' })
  @IsOptional()
  @Transform(toBool)
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar per xicalla (true) o adults (false)' })
  @IsOptional()
  @Transform(toBool)
  isXicalla?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar per membres de la colla (true) o externs (false)' })
  @IsOptional()
  @Transform(toBool)
  isMember?: boolean;

  @ApiPropertyOptional({ description: 'Filtrar per persones provisionals (true) o regulars (false)' })
  @IsOptional()
  @Transform(toBool)
  isProvisional?: boolean;

  @ApiPropertyOptional({ description: 'Número de pàgina (comença a 1)', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Nombre de resultats per pàgina (màx. 100)', default: 50 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 50;

  @ApiPropertyOptional({ description: 'Camp d\'ordenació', enum: PERSON_SORT_BY_FIELDS })
  @IsIn(PERSON_SORT_BY_FIELDS)
  @IsOptional()
  sortBy?: (typeof PERSON_SORT_BY_FIELDS)[number];

  @ApiPropertyOptional({ description: 'Ordre d\'ordenació', enum: PERSON_SORT_ORDER_VALUES })
  @IsIn(PERSON_SORT_ORDER_VALUES)
  @IsOptional()
  @Type(() => String)
  sortOrder?: (typeof PERSON_SORT_ORDER_VALUES)[number];
}
