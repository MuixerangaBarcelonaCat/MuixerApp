export interface ManualPage {
  /** File name in `docs/manual/` without `.md`. */
  slug: string;
  title: string;
  group: string;
}

export const MANUAL_DEFAULT_SLUG = '00-benvinguda';

/** Reading order of the manual. Add a row when a page is added to `docs/manual/` (see CLAUDE.md). */
export const MANUAL_PAGES: readonly ManualPage[] = [
  { slug: '00-benvinguda', title: 'Benvinguda', group: 'Comencem' },
  { slug: '01-primers-passos', title: 'Primers passos', group: 'Comencem' },
  { slug: '02-dades-app-antiga', title: "Dades de l'app antiga", group: 'La base' },
  { slug: '03-persones', title: 'Persones', group: 'La base' },
  { slug: '04-etiquetes', title: 'Etiquetes', group: 'La base' },
  { slug: '05-temporades', title: 'Temporades', group: 'La base' },
  { slug: '06-usuaris-i-acces', title: 'Usuaris i accés', group: 'La base' },
  { slug: '07-assajos-i-actuacions', title: 'Assajos i actuacions', group: 'Events' },
  { slug: '08-plantilles', title: 'Plantilles', group: 'Plantilles' },
  { slug: '09-plantilles-pinya', title: 'Plantilla: pinya i rengles', group: 'Plantilles' },
  { slug: '10-plantilles-tronc', title: 'Plantilla: tronc', group: 'Plantilles' },
  { slug: '11-segments-i-figures', title: 'Segments i figures', group: 'Preparar un event' },
  { slug: '12-assignacio-troncs', title: 'Assignació de troncs', group: 'Preparar un event' },
  { slug: '13-assignacio-pinyes', title: 'Assignació de pinyes', group: 'Preparar un event' },
  { slug: '14-conflictes', title: 'Conflictes', group: 'Preparar un event' },
  { slug: '15-distribucio-i-nodes-extra', title: 'Distribució i nodes extra', group: 'Preparar un event' },
  { slug: '16-previsualitza-i-projeccio', title: 'Previsualitza i projecció', group: 'Preparar un event' },
  { slug: '17-participacio', title: 'Participació', group: 'Preparar un event' },
  { slug: '18-comunicacio', title: 'Comunicació', group: 'Altres' },
  { slug: '19-pwa', title: "L'app dels membres (PWA)", group: 'Altres' },
  { slug: '20-preguntes-frequents', title: 'Preguntes freqüents', group: 'Altres' },
];
