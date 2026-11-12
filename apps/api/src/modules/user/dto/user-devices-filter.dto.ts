import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  USER_DEVICES_SORT_BY_FIELDS,
  USER_SORT_ORDER_VALUES,
} from '../constants/user-sort.constants';

export class UserDevicesFilterDto {
  @ApiPropertyOptional({ description: 'Cerca per correu, nom o àlies' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: "Camp d'ordenació", enum: USER_DEVICES_SORT_BY_FIELDS })
  @IsOptional()
  @IsIn(USER_DEVICES_SORT_BY_FIELDS)
  sortBy?: (typeof USER_DEVICES_SORT_BY_FIELDS)[number];

  @ApiPropertyOptional({ description: "Ordre d'ordenació", enum: USER_SORT_ORDER_VALUES })
  @IsOptional()
  @IsIn(USER_SORT_ORDER_VALUES)
  sortOrder?: (typeof USER_SORT_ORDER_VALUES)[number];

  @ApiPropertyOptional({ description: 'Número de pàgina (comença a 1)', default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre de resultats per pàgina (màx. 100)', default: 25 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
