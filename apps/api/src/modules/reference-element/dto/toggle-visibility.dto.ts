import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsUUID } from 'class-validator';

export class ToggleVisibilityDto {
  @ApiProperty({ description: 'EventSegment UUID to toggle visibility for' })
  @IsUUID('4')
  segmentId: string;

  @ApiProperty({ description: 'true = hide in this segment, false = show' })
  @IsBoolean()
  hidden: boolean;
}
