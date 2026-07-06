import { IsUUID } from 'class-validator';

export class CopyInstanceDto {
  @IsUUID()
  targetSegmentId: string;
}
