import { IsOptional, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class NotificationScheduleFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar per estat actiu (pendent) o inactiu (cancel·lada/enviada)' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;

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
}
