/**
 * Pilar de 4 — figure seed script.
 *
 * Family: "Pilar de 4" | variant 1 of 2
 * This is the 2-cordon variant (ring 1 = crossa/contrafort/mans/vents/laterals,
 * ring 2 = outer mans/vents/laterals). cordó-obert closes the outer ring (ringLevel NULL).
 * Tronc: Base(z=0) → Segon(z=1) → Alçadora(z=2) → Xiqueta(z=3)
 *
 * Usage:
 *   nx run api:seed-figures-pd4           → prints JSON payload
 *   nx run api:seed-figures-pd4-insert    → inserts into DB
 */

import { FigureSeed, insertFigure, printPayload } from './_seed-helper';

const figure: FigureSeed = {
  familyName:   'Pilar de 4',
  familySlug:   'pilar-de-4',
  variantOrder: 1,
  name:         'Pilar de 4 — 2C',
  slug:         'pd4-2c',
  description:  'Pilar de 4 (Pinet doble) — 2 cordons',
  hasPinya:     true,
  direction:    180,
  metadata:     {},
  nodes: [
    // ── PINYA — RING 1 (primer cordó) ─────────────────────────────────────
    // Centre — crosses/contraforts belong to the pinya core, not tied to a specific ring
    { label: 'CROSSA',      zone: 'PINYA', positionType: 'crossa',     x: 436, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#9FA8DA', shape: 'RECTANGLE', sortOrder:  1, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CROSSA',      zone: 'PINYA', positionType: 'crossa',     x: 565, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#9FA8DA', shape: 'RECTANGLE', sortOrder:  2, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CONTRAFORT',  zone: 'PINYA', positionType: 'contrafort', x: 500, y: 458, z: 0, width: 80, height: 36, rotation:   0, color: '#EF9A9A', shape: 'RECTANGLE', sortOrder:  3, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CONTRAFORT',  zone: 'PINYA', positionType: 'contrafort', x: 500, y: 542, z: 0, width: 80, height: 36, rotation:   0, color: '#EF9A9A', shape: 'RECTANGLE', sortOrder:  4, climbPath: null, ringLevel: null, metadata: {} },
    // Braç nord — Ring 1
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 416, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  5, climbPath: null, ringLevel: 1, metadata: {} },
    // Braç sud — Ring 1
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 584, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 10, climbPath: null, ringLevel: 1, metadata: {} },
    // Braç oest — Ring 1
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 391, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 15, climbPath: null, ringLevel: 1, metadata: {} },
    // Braç est — Ring 1
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 610, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 20, climbPath: null, ringLevel: 1, metadata: {} },
    // Diagonals NW — Ring 1
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 411, y: 405, z: 0, width: 80, height: 40, rotation: 315, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 23, climbPath: null, ringLevel: 1, metadata: {} },
    // Diagonals NE — Ring 1
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 592, y: 406, z: 0, width: 80, height: 40, rotation:  45, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 26, climbPath: null, ringLevel: 1, metadata: {} },
    // Diagonals SW — Ring 1
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 412, y: 590, z: 0, width: 80, height: 40, rotation: 225, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 29, climbPath: null, ringLevel: 1, metadata: {} },
    // Diagonals SE — Ring 1
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 595, y: 595, z: 0, width: 80, height: 40, rotation: 135, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 32, climbPath: null, ringLevel: 1, metadata: {} },
    // ── PINYA — RING 2 (segon cordó) ──────────────────────────────────────
    // Braç nord — Ring 2
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 372, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder:  6, climbPath: null, ringLevel: 2, metadata: {} },
    // Braç sud — Ring 2
    { label: 'MANS',        zone: 'PINYA', positionType: 'mans',       x: 500, y: 628, z: 0, width: 80, height: 40, rotation:   0, color: '#FFE082', shape: 'RECTANGLE', sortOrder: 11, climbPath: null, ringLevel: 2, metadata: {} },
    // Braç oest — Ring 2
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 345, y: 500, z: 0, width: 80, height: 40, rotation: 270, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 16, climbPath: null, ringLevel: 2, metadata: {} },
    // Braç est — Ring 2
    { label: 'VENT',        zone: 'PINYA', positionType: 'vents',      x: 655, y: 500, z: 0, width: 80, height: 40, rotation:  90, color: '#A5D6A7', shape: 'RECTANGLE', sortOrder: 21, climbPath: null, ringLevel: 2, metadata: {} },
    // Diagonals NW — Ring 2
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 378, y: 373, z: 0, width: 80, height: 40, rotation: 315, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 24, climbPath: null, ringLevel: 2, metadata: {} },
    // Diagonals NE — Ring 2
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 623, y: 374, z: 0, width: 80, height: 40, rotation:  45, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 27, climbPath: null, ringLevel: 2, metadata: {} },
    // Diagonals SW — Ring 2
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 380, y: 622, z: 0, width: 80, height: 40, rotation: 225, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 30, climbPath: null, ringLevel: 2, metadata: {} },
    // Diagonals SE — Ring 2
    { label: 'LATERAL',     zone: 'PINYA', positionType: 'laterals',   x: 629, y: 627, z: 0, width: 80, height: 40, rotation: 135, color: '#80DEEA', shape: 'RECTANGLE', sortOrder: 33, climbPath: null, ringLevel: 2, metadata: {} },
    // ── CORDÓ OBERT (tanca l'anell exterior, independent del número de cordons) ──
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 500, y: 240, z: 0, width: 64, height: 40, rotation:   0, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder:  9, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 500, y: 760, z: 0, width: 64, height: 40, rotation:   0, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder: 14, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 252, y: 500, z: 0, width: 64, height: 40, rotation: 270, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder: 18, climbPath: null, ringLevel: null, metadata: {} },
    { label: 'CORDÓ OBERT', zone: 'PINYA', positionType: 'cordo-obert', x: 749, y: 500, z: 0, width: 64, height: 40, rotation:  91, color: '#FFF9C4', shape: 'ELLIPSE',    sortOrder: 22, climbPath: null, ringLevel: null, metadata: {} },
  ],
  // ── TRONC + BASE — shared across all "Pilar de 4" variants ──────────────
  // x and width for TRONC are relative tronc units (1u = 1 person width).
  familyNodes: [
    { label: 'BASE',     zone: 'BASE',  positionType: 'base',     x: 500, y: 500, z: 0, width: 80, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder: 0, climbPath: null,  ringLevel: null, metadata: {} },
    { label: 'Segon',    zone: 'TRONC', positionType: 'segon',    x: 0,   y: 0,   z: 1, width: 1,  height: 40, rotation: 0, color: null,      shape: 'RECTANGLE', sortOrder: 0, climbPath: null,  ringLevel: null, metadata: {} },
    { label: 'Alçadora', zone: 'TRONC', positionType: 'alcadora', x: 0,   y: 0,   z: 2, width: 1,  height: 40, rotation: 0, color: null,      shape: 'RECTANGLE', sortOrder: 0, climbPath: '(A)', ringLevel: null, metadata: {} },
    { label: 'Xiqueta',  zone: 'TRONC', positionType: 'xiqueta',  x: 0,   y: 0,   z: 3, width: 1,  height: 40, rotation: 0, color: null,      shape: 'RECTANGLE', sortOrder: 0, climbPath: '(X)', ringLevel: null, metadata: {} },
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
