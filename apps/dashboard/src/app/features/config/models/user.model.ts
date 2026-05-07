import { UserRole } from '@muixer/shared';

export interface UserPerson {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  inviteExpiresAt: string | null;
  person: UserPerson | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

export type UserSortOrder = 'ASC' | 'DESC';

export interface UserFilterParams {
  search?: string;
  role?: UserRole[];
  isActive?: boolean;
  hasCredentials?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: UserSortOrder;
}
