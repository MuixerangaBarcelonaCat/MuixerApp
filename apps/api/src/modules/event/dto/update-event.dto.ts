import { IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsBoolean()
  countsForStatistics?: boolean;

  @IsOptional()
  @IsUUID('4')
  seasonId?: string;
}
