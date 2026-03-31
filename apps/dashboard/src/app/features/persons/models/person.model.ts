import { AvailabilityStatus, OnboardingStatus, FigureZone } from '@muixer/shared';

export interface Position {
  id: string;
  name: string;
  slug: string;
  zone: FigureZone | null;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
  alias: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  shoulderHeight: number | null;
  isXicalla: boolean;
  isMember: boolean;
  availability: AvailabilityStatus;
  onboardingStatus: OnboardingStatus;
  shirtDate: string | null;
  notes: string | null;
  isActive: boolean;
  positions: Position[];
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

export interface PersonFilterParams {
  search?: string;
  positionId?: string;
  availability?: AvailabilityStatus;
  isActive?: boolean;
  isXicalla?: boolean;
  isMember?: boolean;
  page?: number;
  limit?: number;
}

export interface SyncEvent {
  type: 'start' | 'progress' | 'error' | 'complete';
  entity: string;
  current?: number;
  total?: number;
  message: string;
  detail?: Record<string, unknown>;
}
