import { UserRole } from '../enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
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
