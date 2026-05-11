import { Exclude, Expose, Type } from 'class-transformer';
import { AvailabilityStatus, OnboardingStatus } from '@muixer/shared';

class PositionResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  zone: string | null;

  @Expose()
  color: string;
}

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

class ManagedByUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string;

  @Expose()
  @Type(() => ManagedByPersonDto)
  person: ManagedByPersonDto | null;
}

export class PersonResponseDto {
  @Expose()
  id: string;

  @Exclude()
  legacyId: string | null;

  @Expose()
  name: string;

  @Expose()
  firstSurname: string;

  @Expose()
  secondSurname: string | null;

  @Expose()
  alias: string;

  @Expose()
  email: string | null;

  @Expose()
  phone: string | null;

  @Expose()
  birthDate: Date | null;

  @Expose()
  shoulderHeight: number | null;

  @Expose()
  isXicalla: boolean;

  @Expose()
  isMember: boolean;

  @Expose()
  isProvisional: boolean;

  @Expose()
  availability: AvailabilityStatus;

  @Expose()
  onboardingStatus: OnboardingStatus;

  @Expose()
  shirtDate: Date | null;

  @Expose()
  notes: string | null;

  @Expose()
  isActive: boolean;

  @Expose()
  @Type(() => PositionResponseDto)
  positions: PositionResponseDto[];

  @Expose()
  @Type(() => ManagedByUserDto)
  managedBy: ManagedByUserDto | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
