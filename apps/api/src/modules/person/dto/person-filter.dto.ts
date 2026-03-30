import { IsString, IsOptional, IsEnum, IsBoolean, IsInt, Min, Max, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { AvailabilityStatus } from '@muixer/shared';

export class PersonFilterDto {
  @IsString()
  @IsOptional()
  search?: string;

  @IsUUID('4')
  @IsOptional()
  positionId?: string;

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
}
