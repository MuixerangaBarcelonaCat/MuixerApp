import { Expose, Type } from 'class-transformer';
import { UserRole } from '@muixer/shared';

class ManagedByPersonDto {
  @Expose()
  id: string;

  @Expose()
  alias: string;

  @Expose()
  name: string;

  @Expose()
  firstSurname: string;

  @Expose()
  secondSurname: string | null;
}

export class UserResponseDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  role: UserRole;

  @Expose()
  isActive: boolean;

  @Expose()
  inviteExpiresAt: Date | null;

  @Expose()
  @Type(() => ManagedByPersonDto)
  person: ManagedByPersonDto | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}

