/**
 * Pilar de 4 — figure seed script.
 *
 * Data captured from DB on 2026-05-07 after manual editing via template editor.
 * Layout: pinya en creu (BASE + 2 CROSSA + 2 CONTRAFORT + 8 MANS nord/sud +
 *         6 VENTS est/oest + 4 CORDÓ OBERT + 12 LATERALS diagonals)
 * Tronc: Base(z=0) → Segon(z=1) → Alçadora(z=2) → Xiqueta(z=3)
 *
 * Usage:
 *   nx run api:seed-figures-pd4           → prints JSON payload
 *   nx run api:seed-figures-pd4 -- --insert → inserts into DB
 */

import { FigureSeed, insertFigure, printPayload } from './_seed-helper';

const figure: FigureSeed = {
  name:        'Pilar de 4',
  slug:        'pd4',
  description: 'Pilar de 4 (Pinet doble)',
  hasPinya:    true,
  direction:   180,
  metadata:    {},
  nodes: [
    // ── BASE (intersecció pinya-tronc) ────────────────────────────────────
    { label: 'BASE',        zone: 'BASE',  positionType: 'base',        x: 500, y: 500, z: 0, width: 80, height: 40, rotation:   0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder:  0, climbPath: null, metadata: {} },
    // ── PINYA ──────────────────────────────────────────────────────────────
    // Centre
    { label: 'CROSSA',      zone: 'PINYA', positionType: 'crossa',     x: 436, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#9FA8DA', shape: 'RECTANGLE', sortOrder: 34, climbPath: null, metadata: {} },
    { label: 'CROSSA',      zone: 'PINYA', positionType: 'crossa',     x: 565, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#9FA8DA', shape: 'RECTANGLE', sortOrder:  2, climbPath: null, metadata: {} },
    { label: 'CONTRAFORT',  zone: 'PINYA', positionType: 'contrafort', x: 500, y: 458, z: 0, width: 80, height: 36, rotation:   0, color: '#EF9A9A', shape: 'RECTANGLE', sortOrder:  3, climbPath: null, metadata: {} },
    { label: 'CONTRAFORT',  zone: 'PINYA', positionType: 'contrafort', x: 500, y: 542, z: 0, width: 80, height: 36, rotation:   0, color: '#EF9A9A', shape: 'RECTANGLE', sortOrder:  4, climbPath: null, metadata: {} },
    // Braç nord (MANS)
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 416, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  5, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 372, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  6, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 328, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  7, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 284, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  8, climbPath: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 500, y: 240, z: 0, width: 64, height: 40, rotation:  0, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder:  9, climbPath: null, metadata: {} },
    // Braç sud (MANS)
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 584, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 10, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 628, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 11, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 672, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 12, climbPath: null, metadata: {} },
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 716, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 13, climbPath: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 500, y: 760, z: 0, width: 64, height: 40, rotation:  0, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder: 14, climbPath: null, metadata: {} },
    // Braç oest (VENTS)
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 391, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 38, climbPath: null, metadata: {} },
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 345, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 37, climbPath: null, metadata: {} },
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 299, y: 498, z: 0, width: 80, height: 40, rotation: 270, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 38, climbPath: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 252, y: 500, z: 0, width: 64, height: 40, rotation: 270, color: '#FFF9C4', shape: 'ELLIPSE',   sortOrder: 18, climbPath: null, metadata: {} },
    // Braç est (VENTS)
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 610, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 34, climbPath: null, metadata: {} },
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 655, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 33, climbPath: null, metadata: {} },
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 700, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 21, climbPath: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 749, y: 500, z: 0, width: 64, height: 40, rotation:  91, color: '#FFF9C4', shape: 'ELLIPSE',   sortOrder: 22, climbPath: null, metadata: {} },
    // Diagonals NW
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 411, y: 405, z: 0, width: 80, height: 40, rotation: 315, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 23, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 378, y: 373, z: 0, width: 80, height: 40, rotation: 315, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 24, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 344, y: 342, z: 0, width: 80, height: 40, rotation: 315, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 25, climbPath: null, metadata: {} },
    // Diagonals NE
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 592, y: 406, z: 0, width: 80, height: 40, rotation:  45, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 26, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 623, y: 374, z: 0, width: 80, height: 40, rotation:  45, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 27, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 656, y: 343, z: 0, width: 80, height: 40, rotation:  45, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 28, climbPath: null, metadata: {} },
    // Diagonals SW
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 412, y: 590, z: 0, width: 80, height: 40, rotation: 225, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 29, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 380, y: 622, z: 0, width: 80, height: 40, rotation: 225, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 30, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 347, y: 654, z: 0, width: 80, height: 40, rotation: 225, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 31, climbPath: null, metadata: {} },
    // Diagonals SE
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 595, y: 595, z: 0, width: 80, height: 40, rotation: 135, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 32, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 629, y: 627, z: 0, width: 80, height: 40, rotation: 135, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 33, climbPath: null, metadata: {} },
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 662, y: 660, z: 0, width: 80, height: 40, rotation: 135, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 34, climbPath: null, metadata: {} },
    // ── TRONC ──────────────────────────────────────────────────────────────
    { label: 'Segon',    zone: 'TRONC', positionType: 'segon',    x: 0, y: 0, z: 1, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: null,  metadata: {} },
    { label: 'Alçadora', zone: 'TRONC', positionType: 'alcadora', x: 0, y: 0, z: 2, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: '(A)', metadata: {} },
    { label: 'Xiqueta',  zone: 'TRONC', positionType: 'xiqueta',  x: 0, y: 0, z: 3, width: 60, height: 40, rotation: 0, color: null, shape: 'RECTANGLE', sortOrder: 0, climbPath: '(X)', metadata: {} },
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
