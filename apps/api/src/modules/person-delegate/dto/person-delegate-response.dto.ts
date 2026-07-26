import { Expose, Type } from 'class-transformer';
import { DelegateType } from '@muixer/shared';

class DelegateUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;
}

class DelegatePersonDto {
  @Expose()
  id: string;

  @Expose()
  alias: string;
}

export class PersonDelegateResponseDto {
  @Expose()
  id: string;

  @Expose()
  delegateType: DelegateType;

  @Expose()
  isActive: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => DelegateUserDto)
  user: DelegateUserDto;

  @Expose()
  @Type(() => DelegatePersonDto)
  person: DelegatePersonDto;
}
