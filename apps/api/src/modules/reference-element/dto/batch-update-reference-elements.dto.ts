import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class BatchElementDto {
  @ApiProperty()
  @IsUUID('4')
  id: string;

  @ApiProperty()
  @IsNumber()
  x: number;

  @ApiProperty()
  @IsNumber()
  y: number;

  @ApiProperty()
  @IsNumber()
  width: number;

  @ApiProperty()
  @IsNumber()
  height: number;

  @ApiProperty()
  @IsNumber()
  rotation: number;
}

export class BatchUpdateReferenceElementsDto {
  @ApiProperty({ type: [BatchElementDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BatchElementDto)
  elements: BatchElementDto[];
}
