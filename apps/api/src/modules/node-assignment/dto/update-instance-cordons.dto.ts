import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateInstanceCordonsDto {
  @ApiPropertyOptional({ description: 'Number of cordons to show. NULL = all visible.' })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfCordons?: number | null;

  @ApiPropertyOptional({ description: 'Whether cordo-obert nodes are shown/assignable for this instance.' })
  @IsBoolean()
  @IsOptional()
  cordonsObertsEnabled?: boolean;
}
