import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { FigureZone, NodeShape } from '@muixer/shared';

export class CreateFigureNodeDto {
  @ApiProperty({ description: 'Node label, e.g. "Base 1"' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: FigureZone })
  @IsEnum(FigureZone)
  zone: FigureZone;

  @ApiPropertyOptional({ description: 'Free-form position type, e.g. "base", "segon", "cross"' })
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

  @ApiPropertyOptional()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
