import { IsString, IsUUID, IsOptional } from 'class-validator';

export class BulkImportAssignmentDto {
  @IsUUID()
  sourceInstanceId: string;

  @IsOptional()
  @IsUUID()
  sourceCompositionSlotId?: string;
}
