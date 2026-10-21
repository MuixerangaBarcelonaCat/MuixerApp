import { ManualShot } from '../manual-shot';

/** Every manual screenshot. Each section plan adds its own `sNN.ts` here. */
export const MANUAL_SHOTS: ManualShot[] = [
  {
    file: '00-config-manual.png',
    app: 'dashboard',
    path: '/config',
    ready: 'lib-card[title="Manual"]',
    highlight: 'lib-card[title="Manual"] > *',
  },
];
