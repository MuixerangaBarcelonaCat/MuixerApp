/**
 * Pilar de 3 (creu) — figure seed script.
 *
 * Layout: pinya en creu (TRONC + BASE + MANS + VENTS). Variant mínima (1 cordó).
 * Tronc: Base(z=0) → Alçadora(z=1) → Xiqueta(z=2)
 *
 * Usage:
 *   nx run api:seed-figures-pd3-creu           → prints JSON payload
 *   nx run api:seed-figures-pd3-creu-insert    → inserts into DB
 */

import { FigureSeed, insertFigure, printPayload } from './_seed-helper';

const figure: FigureSeed = {
  name:        'Pilar de 3 (creu)',
  slug:        'pd3-creu',
  description: 'Pilar de 3 — 1 cordó (pinya en creu)',
  hasPinya:    true,
  direction:   180,
  metadata:    {},
  nodes: [
    // ── PINYA — RING 1 (1r cordó: creu de suport directe) ────────────────
    { label: 'MANS', zone: 'PINYA', positionType: 'mans',  x: 500, y: 423, z: 0, width: 80, height: 40, rotation:  0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  5, climbPath: null, ringLevel: 1, metadata: {} },
    { label: 'MANS', zone: 'PINYA', positionType: 'mans',  x: 500, y: 584, z: 0, width: 80, height: 40, rotation:  0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 10, climbPath: null, ringLevel: 1, metadata: {} },
    { label: 'VENT', zone: 'PINYA', positionType: 'vents', x: 411, y: 500, z: 0, width: 40, height: 80, rotation:  0, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 15, climbPath: null, ringLevel: 1, metadata: {} },
    { label: 'VENT', zone: 'PINYA', positionType: 'vents', x: 590, y: 500, z: 0, width: 80, height: 40, rotation: 90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 20, climbPath: null, ringLevel: 1, metadata: {} },
    // ── TRONC + BASE ──────────────────────────────────────────────────────
    { label: 'BASE',     zone: 'BASE',  positionType: 'base',     x: 500, y: 500, z: 0, width: 80, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder:  0, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'Alçadora', zone: 'TRONC', positionType: 'alcadora', x: 0,   y: 0,   z: 1, width: 1,  height: 40, rotation: 0, color: null,      shape: 'RECTANGLE', sortOrder:  0, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'Xiqueta',  zone: 'TRONC', positionType: 'xiqueta',  x: 0,   y: 0,   z: 2, width: 1,  height: 40, rotation: 0, color: null,      shape: 'RECTANGLE', sortOrder:  0, climbPath: null, ringLevel: null, metadata: {} },
  ],
};

const INSERT_FLAG = process.argv.includes('--insert');

if (INSERT_FLAG) {
  insertFigure(figure).catch((err) => {
    console.error('Insert failed:', err);
    process.exit(1);
  });
} else {
  printPayload(figure);
}
