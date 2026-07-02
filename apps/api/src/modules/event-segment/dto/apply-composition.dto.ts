import { IsUUID } from 'class-validator';

export class ApplyCompositionDto {
  @IsUUID()
  compositionId: string;
}
