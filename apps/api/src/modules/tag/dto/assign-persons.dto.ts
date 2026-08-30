import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class AssignPersonsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  personIds: string[];
}
