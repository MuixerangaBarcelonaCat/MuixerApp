import { IsEnum, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationSource } from '@muixer/shared';

export class NotificationLogFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar per origen de la notificació', enum: NotificationSource })
  @IsOptional()
  @IsEnum(NotificationSource)
  source?: NotificationSource;

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
