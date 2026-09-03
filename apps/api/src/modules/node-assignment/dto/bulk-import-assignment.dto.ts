import { IsString, IsUUID, IsOptional, IsEnum } from 'class-validator';
import { ImportScope } from '@muixer/shared';

export class BulkImportAssignmentDto {
  @IsUUID()
  sourceInstanceId: string;

  @IsOptional()
  @IsUUID()
  sourceCompositionSlotId?: string;

  @IsOptional()
  @IsEnum(ImportScope)
  scope?: ImportScope;
}
