import { UserRole } from '../enums/user-role.enum';

/** Payload decodificat del JWT d'accés. Disponible com a `request.user` als controllers NestJS. */
export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

/** Resum mínim d'una persona associada a un compte d'usuari (incloent-hi a AuthResponse). */
export interface PersonSummary {
  id: string;
  name: string;
  firstSurname: string;
  alias: string;
  email: string | null;
}

/** Perfil públic d'un usuari autenticat. Retornat per `/auth/me` i inclòs a `AuthResponse`. */
export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  person: PersonSummary | null;
}
