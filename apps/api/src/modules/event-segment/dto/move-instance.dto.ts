import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class MoveInstanceDto {
  @IsUUID()
  targetSegmentId: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  targetIndex?: number;
}
