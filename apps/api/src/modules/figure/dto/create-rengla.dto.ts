import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreateRenglaDto {
  @ApiPropertyOptional({ description: 'Existing rengla UUID — used for upsert matching on update' })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiPropertyOptional({ description: 'Optional display name. Auto-generated if omitted.' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Whether this rengla can have an open cordon at the end (auto-computed from nodes)', default: false })
  @IsBoolean()
  @IsOptional()
  allowsCordoObert?: boolean;
}
