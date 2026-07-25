import { IsUUID, IsEnum } from 'class-validator';
import { DelegateType } from '@muixer/shared';

export class CreatePersonDelegateDto {
  @IsUUID()
  userId: string;

  @IsEnum(DelegateType)
  delegateType: DelegateType;
}
