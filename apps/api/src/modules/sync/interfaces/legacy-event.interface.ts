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

/**
 * Row parsed from /assistencia-export/{eventId} XLSX.
 * Columns: Id | Persona | Comentari | Resposta | Instant | Acompanyants | Data naixement
 * Section-separator rows (Id = 'Id') are filtered out before reaching this type.
 */
export interface XlsxAttendanceRow {
  legacyPersonId: string;           // Col 0 — direct legacy person ID
  personLabel: string;              // Col 1 — "Cognom, Nom / Alias"
  notes: string | null;             // Col 2 — Comentari
  estat: string | null;  // Col 3 — 'Vinc', 'Vinc amb autocar', 'Vinc amb cotxe', 'No vinc', 'Potser', or null
  instant: string | null;           // Col 4 — "DD/MM/YYYY HH:MM:SS" or null
}
