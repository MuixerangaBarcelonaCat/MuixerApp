export interface LegacyAssaig {
  '0': string; // HTML with event_id embedded (pattern: /llista/{id})
  temporada: number;
  data: string; // "17/09/2025" DD/MM/YYYY
  hora_esdeveniment: string; // "18:45"
  dia_setmana: string;
  descripcio: string; // May contain HTML
  n_si: string;
  n_potser: string;
  n_no: string;
  n_canalla: string;
  n_si_tots: string;
  p_mentider: string;
  p_planificades: string;
  mostrar_qr: string;
}

export interface LegacyAssaigDetail {
  temporada: string;
  data: string;
  descripcio: string;
  hora_esdeveniment: string;
  hora_final: string;
  lloc_esdeveniment: string;
  obert: string; // "0" | "1"
  mostrar_qr: string; // "0" | "1"
  informacio: string; // HTML
}

export interface LegacyActuacio {
  '0': string;
  temporada: number;
  data: string;
  hora_autocar: string;
  hora_cotxe: string;
  hora_esdeveniment: string;
  dia_setmana: string;
  descripcio: string;
  resultats: string;
  n_si: string;
  n_bus: string;
  n_potser: string;
  n_no: string;
  n_si_tots: string;
  mostrar_qr: string;
}

export interface LegacyActuacioDetail {
  temporada: string;
  data: string;
  descripcio: string;
  hora_autocar: string;
  hora_cotxe: string;
  hora_esdeveniment: string;
  lloc_autocar: string;
  lloc_cotxe: string;
  lloc_esdeveniment: string;
  colles: string;
  congres: string;
  resultats: string;
  casa: string; // "0" | "1"
  obert: string;
  transport: string; // "0" | "1"
  aforament_autocar: string;
  mostrar_qr: string;
  informacio: string;
  data_tancament: string;
  hora_tancament: string;
}

export interface LegacyAttendance {
  '0': string; // HTML — may contain person link/id
  id_assistencia: string;
  nom_casteller: string; // May contain HTML
  estat: string; // "Vinc" | "No vinc" | "Potser"
  instant: string; // "05/03/2026 12:59:18" DD/MM/YYYY HH:MM:SS
  observacions: string;
  import: string;
  alimentacio: string | null;
  intolerancies: string | null;
}
