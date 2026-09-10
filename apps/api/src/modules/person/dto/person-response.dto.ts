import {
  AvailabilityStatus,
  Gender,
  OnboardingStatus,
  TagCategory,
  TagCompliance,
  evaluateTagCompliance,
} from '@muixer/shared';
import { Person } from '../person.entity';
import { Tag } from '../../tag/tag.entity';
import { User } from '../../user/user.entity';

export type PersonAccountState = 'NONE' | 'PENDING_ACTIVATION' | 'ACTIVE';

export class PersonPositionDto {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  category: TagCategory;
  positionTypes: string[];
}

export class TechnicalPersonDirectoryItemDto {
  id: string;
  name: string;
  alias: string;
  positions: PersonPositionDto[];
}

export class OperationalPersonDetailDto {
  id: string;
  name: string;
  alias: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  isMember: boolean;
  isProvisional: boolean;
  availability: AvailabilityStatus;
  onboardingStatus: OnboardingStatus;
  shirtDate: Date | null;
  notes: string | null;
  notesEmoji: string | null;
  isActive: boolean;
  positions: PersonPositionDto[];
  tagCompliance: TagCompliance;
  accountState: PersonAccountState;
}

export class AdminPersonListItemDto extends OperationalPersonDetailDto {
  firstSurname: string;
  secondSurname: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: Gender | null;
  attendedCount: number;
  user: AdminPersonUserDto | null;
  createdAt: Date;
  updatedAt: Date;
}

export class AdminPersonUserDto {
  id: string;
  email: string | null;
  state: PersonAccountState;
}

export class AdminPersonDetailDto extends OperationalPersonDetailDto {
  firstSurname: string;
  secondSurname: string | null;
  phone: string | null;
  birthDate: Date | null;
  gender: Gender | null;
  user: AdminPersonUserDto | null;
  createdAt: Date;
  updatedAt: Date;
}

type PersonWithListData = Person & { attendedCount?: number };

function toAccountState(user: User | null | undefined): PersonAccountState {
  if (!user) return 'NONE';
  return user.isActive ? 'ACTIVE' : 'PENDING_ACTIVATION';
}

function toPositionDto(position: Tag): PersonPositionDto {
  return {
    id: position.id,
    name: position.name,
    slug: position.slug,
    color: position.color,
    category: position.category,
    positionTypes: position.positionTypes,
  };
}

function toPositions(person: Person): PersonPositionDto[] {
  return (person.positions ?? []).map(toPositionDto);
}

function toOperationalFields(person: Person): OperationalPersonDetailDto {
  const positions = toPositions(person);
  return {
    id: person.id,
    name: person.name,
    alias: person.alias,
    shoulderHeight: person.shoulderHeight,
    isXicalla: person.isXicalla,
    isMember: person.isMember,
    isProvisional: person.isProvisional,
    availability: person.availability,
    onboardingStatus: person.onboardingStatus,
    shirtDate: person.shirtDate,
    notes: person.notes,
    notesEmoji: person.notesEmoji,
    isActive: person.isActive,
    positions,
    tagCompliance: evaluateTagCompliance(positions.map((position) => position.category)),
    accountState: toAccountState(person.user as User | null),
  };
}

function toAdminUser(user: User | null | undefined): AdminPersonUserDto | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    state: toAccountState(user),
  };
}

export function toTechnicalPersonDirectoryItem(
  person: Person,
): TechnicalPersonDirectoryItemDto {
  return {
    id: person.id,
    name: person.name,
    alias: person.alias,
    positions: toPositions(person),
  };
}

export function toOperationalPersonDetail(person: Person): OperationalPersonDetailDto {
  return toOperationalFields(person);
}

export function toAdminPersonListItem(person: PersonWithListData): AdminPersonListItemDto {
  return {
    ...toOperationalFields(person),
    firstSurname: person.firstSurname,
    secondSurname: person.secondSurname,
    phone: person.phone,
    birthDate: person.birthDate,
    gender: person.gender,
    attendedCount: person.attendedCount ?? 0,
    user: toAdminUser(person.user as User | null),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}

export function toAdminPersonDetail(person: Person): AdminPersonDetailDto {
  return {
    ...toOperationalFields(person),
    firstSurname: person.firstSurname,
    secondSurname: person.secondSurname,
    phone: person.phone,
    birthDate: person.birthDate,
    gender: person.gender,
    user: toAdminUser(person.user as User | null),
    createdAt: person.createdAt,
    updatedAt: person.updatedAt,
  };
}
