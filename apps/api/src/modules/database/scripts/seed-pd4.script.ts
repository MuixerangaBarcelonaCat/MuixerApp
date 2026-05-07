/**
 * Pilar de 4 (pd4) figure seed script.
 *
 * Usage:
 *   nx run api:seed-pd4           → prints the JSON payload + curl command
 *   nx run api:seed-pd4 -- --insert → inserts the figure directly into the DB
 *
 * Layout (35 nodes, all zone=PINYA, z=0):
 *   - Center cluster: BAIX + 2×CROSSA (flanking) + 2×CONTRAFORT (top/bottom)
 *   - N arm: 4×MANS (stacked north) + CORDÓ OBERT ellipse at tip
 *   - S arm: mirror of N arm
 *   - W arm: 3×VENT (going west) + CORDÓ OBERT ellipse at tip
 *   - E arm: mirror of W arm
 *   - Diagonals: 3×LATERAL per corner (NW, NE, SW, SE) at ±45°
 */

import 'reflect-metadata';

// ---------------------------------------------------------------------------
// Figure node definitions
// ---------------------------------------------------------------------------

const CENTER_X = 500;
const CENTER_Y = 500;
const GAP = 4;

const SZ = {
  baix:          [80, 40],
  crossa:        [36, 80],
  contrafort:    [80, 36],
  mans:          [80, 40],
  vents:         [40, 80],
  laterals:      [80, 40],
  'cordo-obert': [64, 40],
} as const;

const COLORS = {
  baix:          '#EEEEEE',
  crossa:        '#9FA8DA',
  contrafort:    '#EF9A9A',
  mans:          '#FFE082',
  vents:         '#A5D6A7',
  laterals:      '#80DEEA',
  'cordo-obert': '#FFF9C4',
} as const;

type PosType = keyof typeof COLORS;

interface NodePayload {
  label: string;
  zone: string;
  positionType: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string;
  shape: 'RECTANGLE' | 'ELLIPSE';
  sortOrder: number;
  climbPath: null;
  metadata: Record<string, unknown>;
}

function buildNodes(): NodePayload[] {
  const nodes: NodePayload[] = [];
  let order = 0;

  function add(
    label: string,
    type: PosType,
    x: number,
    y: number,
    rotation = 0,
    shape: 'RECTANGLE' | 'ELLIPSE' = 'RECTANGLE',
  ): void {
    const [width, height] = SZ[type];
    nodes.push({
      label,
      zone: 'PINYA',
      positionType: type,
      x: Math.round(x),
      y: Math.round(y),
      z: 0,
      width,
      height,
      rotation,
      color: COLORS[type],
      shape,
      sortOrder: order++,
      climbPath: null,
      metadata: {},
    });
  }

  const [bW, bH]   = SZ.baix;
  const [cW]       = SZ.crossa;
  const [, cfH]    = SZ.contrafort;
  const [, mH]     = SZ.mans;
  const [vW]       = SZ.vents;
  const cordoW     = SZ['cordo-obert'][0];
  const cordoH     = SZ['cordo-obert'][1];

  // ---- Center cluster ---------------------------------------------------
  add('BAIX', 'baix', CENTER_X, CENTER_Y);

  const crossaOffX = bW / 2 + GAP + cW / 2;
  add('CROSSA', 'crossa', CENTER_X - crossaOffX, CENTER_Y);
  add('CROSSA', 'crossa', CENTER_X + crossaOffX, CENTER_Y);

  const contraOffY = bH / 2 + GAP + cfH / 2;
  add('CONTRAFORT', 'contrafort', CENTER_X, CENTER_Y - contraOffY);
  add('CONTRAFORT', 'contrafort', CENTER_X, CENTER_Y + contraOffY);

  const clusterTopEdge    = CENTER_Y - bH / 2 - GAP - cfH;
  const clusterBottomEdge = CENTER_Y + bH / 2 + GAP + cfH;
  const clusterLeftEdge   = CENTER_X - bW / 2 - GAP - cW;
  const clusterRightEdge  = CENTER_X + bW / 2 + GAP + cW;

  // ---- North arm --------------------------------------------------------
  let yEdge = clusterTopEdge;
  for (let i = 0; i < 4; i++) {
    const cy = yEdge - GAP - mH / 2;
    add('MANS', 'mans', CENTER_X, cy);
    yEdge = cy - mH / 2;
  }
  add('CORDÓ OBERT', 'cordo-obert', CENTER_X, yEdge - GAP - cordoH / 2, 0, 'ELLIPSE');

  // ---- South arm --------------------------------------------------------
  yEdge = clusterBottomEdge;
  for (let i = 0; i < 4; i++) {
    const cy = yEdge + GAP + mH / 2;
    add('MANS', 'mans', CENTER_X, cy);
    yEdge = cy + mH / 2;
  }
  add('CORDÓ OBERT', 'cordo-obert', CENTER_X, yEdge + GAP + cordoH / 2, 0, 'ELLIPSE');

  // ---- West arm ---------------------------------------------------------
  let xEdge = clusterLeftEdge;
  for (let i = 0; i < 3; i++) {
    const cx = xEdge - GAP - vW / 2;
    add('VENT', 'vents', cx, CENTER_Y);
    xEdge = cx - vW / 2;
  }
  add('CORDÓ OBERT', 'cordo-obert', xEdge - GAP - cordoW / 2, CENTER_Y, 0, 'ELLIPSE');

  // ---- East arm ---------------------------------------------------------
  xEdge = clusterRightEdge;
  for (let i = 0; i < 3; i++) {
    const cx = xEdge + GAP + vW / 2;
    add('VENT', 'vents', cx, CENTER_Y);
    xEdge = cx + vW / 2;
  }
  add('CORDÓ OBERT', 'cordo-obert', xEdge + GAP + cordoW / 2, CENTER_Y, 0, 'ELLIPSE');

  // ---- Diagonals: 3×LATERAL per corner ---------------------------------
  const DIAG_STEP = 50;
  const corners = [
    { cx: clusterLeftEdge,  cy: clusterTopEdge,    dx: -1, dy: -1, rotation:  45 },
    { cx: clusterRightEdge, cy: clusterTopEdge,    dx:  1, dy: -1, rotation: -45 },
    { cx: clusterLeftEdge,  cy: clusterBottomEdge, dx: -1, dy:  1, rotation: -45 },
    { cx: clusterRightEdge, cy: clusterBottomEdge, dx:  1, dy:  1, rotation:  45 },
  ] as const;

  for (const { cx, cy, dx, dy, rotation } of corners) {
    for (let i = 1; i <= 3; i++) {
      add('LATERAL', 'laterals', cx + dx * DIAG_STEP * i, cy + dy * DIAG_STEP * i, rotation);
    }
  }

  return nodes;
}

// ---------------------------------------------------------------------------
// Figure payload
// ---------------------------------------------------------------------------

const TRONC_NODES: NodePayload[] = [
  { label: 'Baix',  zone: 'TRONC', positionType: 'baix',  x: 0, y: 0, z: 0, width: 60, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
  { label: 'Segon', zone: 'TRONC', positionType: 'segon', x: 0, y: 0, z: 1, width: 60, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
  { label: 'Terç',  zone: 'TRONC', positionType: 'terç',  x: 0, y: 0, z: 2, width: 60, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
  { label: 'Quart', zone: 'TRONC', positionType: 'quart', x: 0, y: 0, z: 3, width: 60, height: 40, rotation: 0, color: '#EEEEEE', shape: 'RECTANGLE', sortOrder: 0, climbPath: null, metadata: {} },
];

const payload = {
  name:        'Pilar de 4',
  slug:        'pd4',
  description: 'Pilar de 4 (Pinet doble)',
  hasPinya:    true,
  direction:   180,
  metadata:    {} as Record<string, unknown>,
  nodes:       [...buildNodes(), ...TRONC_NODES],
};

// ---------------------------------------------------------------------------
// --insert mode: bootstrap NestJS and write directly to DB
// ---------------------------------------------------------------------------

async function insertIntoDB(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { getRepositoryToken } = await import('@nestjs/typeorm');
  const { AppModule } = await import('../../../app/app.module');
  const { FigureTemplate } = await import('../../figure/entities/figure-template.entity');
  const { FigureNode } = await import('../../figure/entities/figure-node.entity');

  const { Repository } = await import('typeorm');
  void Repository; // imported for type inference at runtime

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const templateRepo = app.get<import('typeorm').Repository<import('../../figure/entities/figure-template.entity').FigureTemplate>>(
    getRepositoryToken(FigureTemplate),
  );
  const nodeRepo = app.get<import('typeorm').Repository<import('../../figure/entities/figure-node.entity').FigureNode>>(
    getRepositoryToken(FigureNode),
  );

  // Check for existing slug
  const existing = await templateRepo.findOne({ where: { slug: payload.slug } });
  if (existing) {
    console.log(`\n⚠️  Figure with slug "${payload.slug}" already exists (id: ${existing.id}).`);
    console.log('   Skipping insert. Delete it first or run with a different slug.\n');
    await app.close();
    return;
  }

  const template = templateRepo.create({
    name:        payload.name,
    slug:        payload.slug,
    description: payload.description,
    hasPinya:    payload.hasPinya,
    direction:   payload.direction,
    metadata:    payload.metadata,
  });
  const saved = await templateRepo.save(template);

  const nodeEntities = payload.nodes.map((n) =>
    nodeRepo.create({
      template:     saved,
      label:        n.label,
      zone:         n.zone as import('../../../../../../libs/shared/src/enums/figure-zone.enum').FigureZone,
      positionType: n.positionType,
      x:            n.x,
      y:            n.y,
      z:            n.z,
      width:        n.width,
      height:       n.height,
      rotation:     n.rotation,
      color:        n.color,
      shape:        n.shape as import('../../../../../../libs/shared/src/enums/node-shape.enum').NodeShape,
      sortOrder:    n.sortOrder,
      climbPath:    n.climbPath,
      metadata:     n.metadata,
    }),
  );
  await nodeRepo.save(nodeEntities);

  console.log(`\n✅  "${payload.name}" creada correctament!`);
  console.log(`   ID: ${saved.id}`);
  console.log(`   Nodes inserits: ${nodeEntities.length}`);
  console.log(`\n   Obre-la al dashboard: /pinyes/templates/${saved.id}/edit\n`);

  await app.close();
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const INSERT_FLAG = process.argv.includes('--insert');

if (INSERT_FLAG) {
  insertIntoDB().catch((err) => {
    console.error('Insert failed:', err);
    process.exit(1);
  });
} else {
  const json = JSON.stringify(payload, null, 2);
  console.log('\n=== PILAR DE 4 — JSON PAYLOAD ===\n');
  console.log(json);
  console.log('\n=== CURL COMMAND ===\n');
  console.log(
    `curl -s -X POST http://localhost:3000/api/figure-templates \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\
  -d '${JSON.stringify(payload)}' | jq .`,
  );
  console.log('\nOr run with --insert to insert directly:\n');
  console.log('  nx run api:seed-pd4 -- --insert\n');
  console.log(`Total nodes: ${payload.nodes.length}`);
}
