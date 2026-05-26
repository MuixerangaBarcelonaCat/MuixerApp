import { IsUUID } from 'class-validator';

export class SwapAssignmentsDto {
  @IsUUID()
  assignmentIdA: string;

  @IsUUID()
  assignmentIdB: string;
}
