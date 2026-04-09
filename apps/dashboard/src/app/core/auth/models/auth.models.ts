import { UserRole, ClientType } from '@muixer/shared';

export interface LoginRequest {
  email: string;
  password: string;
  clientType: ClientType;
}

export interface PersonSummary {
  id: string;
  name: string;
  firstSurname: string;
  alias: string;
  email: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  person: PersonSummary | null;
}

export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}
