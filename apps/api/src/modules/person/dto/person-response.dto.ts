import { Exclude, Expose, Transform, Type } from 'class-transformer';
import {
  AvailabilityStatus,
  Gender,
  OnboardingStatus,
  TagCategory,
  TagCompliance,
  evaluateTagCompliance,
} from '@muixer/shared';

class PositionResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose()
  slug: string;

  @Expose()
  color: string;

  @Expose()
  category: TagCategory;

  @Expose()
  positionTypes: string[];
}

class PersonSelfUserDto {
  @Expose()
  id: string;

  @Expose()
  email: string | null;

  @Expose()
  isActive: boolean;
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
  phone: string | null;

  @Expose()
  birthDate: Date | null;

  @Expose()
  shoulderHeight: number | null;

  @Expose()
  gender: Gender | null;

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
  notesEmoji: string | null;

  @Expose()
  isActive: boolean;

  @Expose()
  @Type(() => PositionResponseDto)
  positions: PositionResponseDto[];

  /** Avís, mai una validació: alimenta un badge i el filtre `tagRuleOk`. */
  @Expose()
  @Transform(({ obj }) =>
    evaluateTagCompliance(
      ((obj.positions ?? []) as { category: TagCategory }[]).map((p) => p.category),
    ),
  )
  tagCompliance: TagCompliance;

  /** Assistències `ASSISTIT` de la temporada en curs; només la llista paginada el resol. */
  @Expose()
  @Transform(({ obj }) => obj.attendedCount ?? 0)
  attendedCount: number;

  @Expose()
  @Type(() => PersonSelfUserDto)
  user: PersonSelfUserDto | null;

  @Expose()
  createdAt: Date;

  @Expose()
  updatedAt: Date;
}
