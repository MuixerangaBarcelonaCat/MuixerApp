import { AvailabilityStatus, OnboardingStatus, FigureZone, TagCategory, TagCompliance } from '@muixer/shared';

export interface Position {
  id: string;
  name: string;
  slug: string;
  zone: FigureZone | null;
  color: string;
  category: TagCategory;
}

export interface Person {
  id: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
  alias: string;
  phone: string | null;
  birthDate: string | null;
  shoulderHeight: number | null;
  isXicalla: boolean;
  isMember: boolean;
  isProvisional?: boolean;
  availability: AvailabilityStatus;
  onboardingStatus: OnboardingStatus;
  shirtDate: string | null;
  notes: string | null;
  notesEmoji: string | null;
  isActive: boolean;
  positions: Position[];
  user: { id: string; email: string | null; isActive: boolean } | null;
  tagCompliance: TagCompliance;
  /** ASSISTIT attendances in the current season. Only populated on the list endpoint. */
  attendedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export type PersonSortOrder = 'ASC' | 'DESC';

export interface PersonFilterParams {
  search?: string;
  positionIds?: string[];
  positionCategory?: string[];
  availability?: AvailabilityStatus;
  isActive?: boolean;
  isXicalla?: boolean;
  isMember?: boolean;
  isProvisional?: boolean;
  tagRuleOk?: boolean;
  page?: number;
  limit?: number;
  /** API sort field (see backend PERSON_SORT_BY_FIELDS) */
  sortBy?: string;
  sortOrder?: PersonSortOrder;
}

export interface SyncEvent {
  type: 'start' | 'progress' | 'warn' | 'error' | 'complete';
  entity: string;
  current?: number;
  total?: number;
  message: string;
  detail?: Record<string, unknown>;
}

export interface UpdatePersonDto {
  id: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
  alias: string;
  phone: string | null;
  birthDate: string | null;
  shoulderHeight: number | null;
  isXicalla: boolean;
  isMember: boolean;
  isProvisional?: boolean;
  availability: AvailabilityStatus;
  onboardingStatus: OnboardingStatus;
  shirtDate: string | null;
  notes: string | null;
  notesEmoji: string | null;
  isActive: boolean;
  positions: string[];
  createdAt: string;
  updatedAt: string;
}
