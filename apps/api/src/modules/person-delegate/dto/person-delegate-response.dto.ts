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
  email: string;

  /** The delegate's own linked person, if self-managed — lets the UI link to their profile. */
  @Expose()
  @Type(() => DelegatePersonDto)
  person: DelegatePersonDto | null;
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
