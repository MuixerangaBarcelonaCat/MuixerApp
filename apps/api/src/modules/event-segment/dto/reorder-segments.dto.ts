import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderSegmentsDto {
  @ApiProperty({
    description: 'Ordered array of segment UUIDs. sortOrder is reassigned based on array position.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  segmentIds: string[];
}
