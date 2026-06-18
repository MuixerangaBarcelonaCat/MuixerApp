import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInstanceCordonsDto {
  @ApiPropertyOptional({ description: 'Number of cordons to show. NULL = all visible.' })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfCordons?: number | null;
}
