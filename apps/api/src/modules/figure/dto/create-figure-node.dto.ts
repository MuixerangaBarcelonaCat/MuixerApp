import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';
import { FigureZone, NodeShape } from '@muixer/shared';

export class CreateFigureNodeDto {
  @ApiPropertyOptional({ description: 'Existing node UUID — used for upsert matching on update' })
  @IsUUID()
  @IsOptional()
  id?: string;

  @ApiProperty({ description: 'Node label, e.g. "Base 1"' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: FigureZone })
  @IsEnum(FigureZone)
  zone: FigureZone;

  @ApiPropertyOptional({ description: 'Free-form position type, e.g. "laterals", "mans", "vents"' })
  @IsString()
  @IsOptional()
  positionType?: string;

  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiPropertyOptional({ description: 'Floor (0=base, 1=segon, 2=terç…)', default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  z?: number;

  @ApiProperty({ description: 'Width (rectangle) or rx (ellipse)' })
  @IsNumber()
  width: number;

  @ApiProperty({ description: 'Height (rectangle) or ry (ellipse)' })
  @IsNumber()
  height: number;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  rotation?: number;

  @ApiPropertyOptional({ description: 'Hex color, e.g. "#FF5733"' })
  @IsString()
  @IsOptional()
  color?: string;

  @ApiProperty({ enum: NodeShape })
  @IsEnum(NodeShape)
  shape: NodeShape;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional({ description: 'Climb path marker, e.g. "(X)" or "(A)"' })
  @IsString()
  @IsOptional()
  climbPath?: string;

  @ApiPropertyOptional({ description: 'Concentric ring level (1 = innermost). Only for PINYA zone nodes.' })
  @IsInt()
  @Min(1)
  @IsOptional()
  ringLevel?: number;

  @ApiPropertyOptional({ description: 'Root ancestor node ID (set automatically on variant derivation)' })
  @IsUUID()
  @IsOptional()
  originNodeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
