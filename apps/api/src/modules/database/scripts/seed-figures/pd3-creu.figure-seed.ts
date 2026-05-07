/**
 * Pilar de 3 (creu) — figure seed script.
 *
 * Data captured from DB on 2026-05-07 after manual editing via template editor.
 * Layout: pinya en creu simplificada (BAIX + 1 MANS nord + 1 MANS sud +
 *         1 VENT oest + 1 VENT est). Sense laterals diagonals.
 * Tronc: Baix → Alçadora → Xiqueta (3 nivells, z 0–2)
 *
 * Usage:
 *   nx run api:seed-figures-pd3-creu           → prints JSON payload
 *   nx run api:seed-figures-pd3-creu -- --insert → inserts into DB
 */

import { FigureSeed, insertFigure, printPayload } from './_seed-helper';

const figure: FigureSeed = {
  name:        'Pilar de 3 (creu)',
  slug:        'pd3-creu',
  description: 'Pilar de 3 amb pinya en creu',
  hasPinya:    true,
  direction:   180,
  metadata:    {},
  nodes: [
    // ── PINYA ──────────────────────────────────────────────────────────────
    { label: 'BAIX', zone: 'PINYA', positionType: 'baix',  x: 500, y: 500, z: 0, width: 80, height: 40, rotation:  0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder:  0, climbPath: null, metadata: {} },
    // Braç nord
    { label: 'MANS', zone: 'PINYA', positionType: 'mans',  x: 500, y: 423, z: 0, width: 80, height: 40, rotation:  0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  5, climbPath: null, metadata: {} },
    // Braç sud
    { label: 'MANS', zone: 'PINYA', positionType: 'mans',  x: 500, y: 584, z: 0, width: 80, height: 40, rotation:  0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 10, climbPath: null, metadata: {} },
    // Braç oest
    { label: 'VENT', zone: 'PINYA', positionType: 'vents', x: 411, y: 500, z: 0, width: 40, height: 80, rotation:  0, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 15, climbPath: null, metadata: {} },
    // Braç est
    { label: 'VENT', zone: 'PINYA', positionType: 'vents', x: 590, y: 500, z: 0, width: 80, height: 40, rotation: 90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 34, climbPath: null, metadata: {} },
    // ── TRONC ──────────────────────────────────────────────────────────────
    { label: 'Baix',     zone: 'TRONC', positionType: 'baix',     x: 0, y: 0, z: 0, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
    { label: 'Alçadora', zone: 'TRONC', positionType: 'alcadora', x: 0, y: 0, z: 1, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
    { label: 'Xiqueta',  zone: 'TRONC', positionType: 'xiqueta',  x: 0, y: 0, z: 2, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
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
