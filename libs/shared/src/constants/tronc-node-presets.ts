export interface TroncNodePreset {
  positionType: string;
  label: string;
  color: string;
}

export const TRONC_NODE_PRESETS: TroncNodePreset[] = [
  { positionType: 'segones', label: 'Segones', color: '#1E88E5' },
  { positionType: 'terceres', label: 'Terçes', color: '#43A047' },
  { positionType: 'quartes', label: 'Quartes', color: '#FB8C00' },
  { positionType: 'quintes', label: 'Quintes', color: '#8E24AA' },
  { positionType: 'puntal', label: 'Puntal', color: '#795548' },
  { positionType: 'alçadora', label: 'Alçadora', color: '#00ACC1' },
  { positionType: 'xiqueta', label: 'Xiqueta', color: '#E53935' },
];
