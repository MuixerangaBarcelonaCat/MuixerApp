import { IsUUID, IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { DelegateType } from '@muixer/shared';

export class CreatePersonDelegateDto {
  @IsUUID()
  userId: string;

  @IsEnum(DelegateType)
  delegateType: DelegateType;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
