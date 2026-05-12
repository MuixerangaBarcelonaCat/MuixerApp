import { IsString, IsUUID, IsOptional } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  nodeId: string;

  @IsUUID()
  personId: string;

  @IsOptional()
  @IsUUID()
  compositionSlotId?: string;
}
