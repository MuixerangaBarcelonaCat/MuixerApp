import { IsString, IsUUID } from 'class-validator';

export class CreateAssignmentDto {
  @IsUUID()
  nodeId: string;

  @IsUUID()
  personId: string;
}
