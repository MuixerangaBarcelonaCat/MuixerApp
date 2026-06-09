import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsIn,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import {
  USER_SORT_BY_FIELDS,
  USER_SORT_ORDER_VALUES,
} from '../constants/user-sort.constants';

export class UserFilterDto {
  @ApiPropertyOptional({
    description: 'Filtrar per rols (multiselect)',
    enum: UserRole,
    isArray: true,
  })
  @IsOptional()
  @IsEnum(UserRole, { each: true })
  @Transform(({ value }) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return [value];
    return value;
  })
  role?: UserRole[];

  @ApiPropertyOptional({ description: 'Filtrar per estat actiu' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Filtrar per usuaris amb credencials (poden fer login)',
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  hasCredentials?: boolean;

  @ApiPropertyOptional({ description: 'Cerca per email, nom o alias' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Camp d'ordenació",
    enum: USER_SORT_BY_FIELDS,
  })
  @IsOptional()
  @IsIn(USER_SORT_BY_FIELDS)
  sortBy?: (typeof USER_SORT_BY_FIELDS)[number];

  @ApiPropertyOptional({
    description: "Ordre d'ordenació",
    enum: USER_SORT_ORDER_VALUES,
  })
  @IsOptional()
  @IsIn(USER_SORT_ORDER_VALUES)
  sortOrder?: (typeof USER_SORT_ORDER_VALUES)[number];

  @ApiPropertyOptional({
    description: 'Número de pàgina (comença a 1)',
    default: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Nombre de resultats per pàgina (màx. 100)',
    default: 25,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 25;
}
