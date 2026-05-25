import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class InstanceLayoutDto {
  @ApiProperty()
  @IsUUID('4')
  instanceId: string;

  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiProperty({ default: 1.0 })
  @IsNumber()
  scale: number;
}

export class UpdateProjectionLayoutDto {
  @ApiProperty({ type: [InstanceLayoutDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InstanceLayoutDto)
  layouts: InstanceLayoutDto[];
}
