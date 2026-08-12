import { IsEnum, IsBoolean, IsOptional } from 'class-validator';
import { DelegateType } from '@muixer/shared';

export class UpdatePersonDelegateDto {
  @IsOptional()
  @IsEnum(DelegateType)
  delegateType?: DelegateType;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
