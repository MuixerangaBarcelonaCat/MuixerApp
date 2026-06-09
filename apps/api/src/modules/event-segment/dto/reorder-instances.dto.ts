import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID } from 'class-validator';

export class ReorderInstancesDto {
  @ApiProperty({
    description: 'Ordered array of instance UUIDs. sortOrder is reassigned based on array position.',
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  instanceIds: string[];
}
