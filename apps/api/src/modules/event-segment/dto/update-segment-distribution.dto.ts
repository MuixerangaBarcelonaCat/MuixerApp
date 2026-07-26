import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class InstanceDistributionDto {
  @ApiProperty()
  @IsUUID('4')
  instanceId: string;

  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiProperty({ default: 0 })
  @IsNumber()
  angle: number;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  troncPanelX: number | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  troncPanelY: number | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  troncPanelWidth: number | null;

  @ApiProperty({ nullable: true })
  @IsOptional()
  @ValidateIf((_o, value) => value !== null)
  @IsNumber()
  troncPanelHeight: number | null;
}

export class UpdateSegmentDistributionDto {
  @ApiProperty({ type: [InstanceDistributionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstanceDistributionDto)
  items: InstanceDistributionDto[];
}
