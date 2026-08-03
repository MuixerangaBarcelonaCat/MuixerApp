import { UserRole } from '../enums/user-role.enum';
import { ClientType } from '../enums/client-type.enum';

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
  /** ISO timestamp de quan el compte va acceptar la política de privacitat (null = mai). */
  privacyPolicyAcceptedAt: string | null;
  /** True si cal (re)acceptar la política: la versió activa supera la que l'usuari va acceptar. */
  requiresPrivacyConsent: boolean;
  person: PersonSummary | null;
}

/** Cos de la petició POST /auth/login. */
export interface LoginRequest {
  email: string;
  password: string;
  clientType: ClientType;
}

/** Resposta de /auth/login i /auth/refresh. */
export interface AuthResponse {
  accessToken: string;
  user: UserProfile;
}
