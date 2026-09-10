import { Expose, Type } from 'class-transformer';
import { DelegateType } from '@muixer/shared';

class DelegatePersonDto {
  @Expose()
  id: string;

  @Expose()
  alias: string;
}

class DelegateUserDto {
  @Expose()
  id: string;

  @Expose()
  @Type(() => DelegatePersonDto)
  person: DelegatePersonDto | null;
}

class AdminDelegateUserDto extends DelegateUserDto {
  @Expose()
  email: string | null;
}

export class PersonDelegateResponseDto {
  @Expose()
  id: string;

  @Expose()
  delegateType: DelegateType;

  @Expose()
  isActive: boolean;

  @Expose()
  isPrimary: boolean;

  @Expose()
  createdAt: Date;

  @Expose()
  @Type(() => DelegateUserDto)
  user: DelegateUserDto;

  @Expose()
  @Type(() => DelegatePersonDto)
  person: DelegatePersonDto;
}

export class AdminPersonDelegateResponseDto extends PersonDelegateResponseDto {
  @Expose()
  @Type(() => AdminDelegateUserDto)
  declare user: AdminDelegateUserDto;
}
