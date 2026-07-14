import { IsEnum, IsOptional } from 'class-validator';
import { SegmentMoveConflictResolution } from '@muixer/shared';

export class MoveInstanceQueryDto {
  @IsEnum(SegmentMoveConflictResolution)
  @IsOptional()
  conflictResolution?: SegmentMoveConflictResolution;
}
