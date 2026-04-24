/**
 * Rols d'usuari del sistema.
 * - ADMIN: accés complet (gestió d'usuaris, configuració)
 * - TECHNICAL: accés tècnic (sync, edició de dades, dashboard)
 * - MEMBER: accés bàsic (PWA, visualització de les pròpies dades)
 */
export enum UserRole {
  ADMIN = 'ADMIN',
  TECHNICAL = 'TECHNICAL',
  MEMBER = 'MEMBER',
}
