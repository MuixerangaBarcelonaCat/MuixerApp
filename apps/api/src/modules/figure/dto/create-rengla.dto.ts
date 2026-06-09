import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
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

  @ApiProperty({ description: 'Rengla display name, e.g. "Mans Nord"' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'First cordon where this rengla starts existing (1 = always)', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  startPosition?: number;

  @ApiPropertyOptional({ description: 'Whether this rengla can have an open cordon at the end', default: false })
  @IsBoolean()
  @IsOptional()
  allowsCordoObert?: boolean;
}
