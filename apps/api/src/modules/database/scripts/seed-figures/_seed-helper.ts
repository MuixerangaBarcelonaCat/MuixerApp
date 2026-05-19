/**
 * Shared helper for figure seed scripts.
 *
 * Each figure in seed-figures/ imports `insertFigure` and `printPayload`
 * from here so the NestJS bootstrap boilerplate is not duplicated.
 */

import 'reflect-metadata';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NodeSeed {
  label: string;
  zone: string;
  positionType: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: 'RECTANGLE' | 'ELLIPSE';
  sortOrder: number;
  climbPath: string | null;
  /** Concentric ring level (1 = innermost). NULL for non-pinya nodes. */
  ringLevel?: number | null;
  /** Root ancestor node ID — set when deriving from another variant. */
  originNodeId?: string | null;
  metadata: Record<string, unknown>;
}

export interface FigureSeed {
  /** Name of the FigureFamily this template belongs to. Created if it doesn't exist. */
  familyName: string;
  /** Slug of the FigureFamily. */
  familySlug: string;
  /** Position within the family (1 = smallest). */
  variantOrder: number;
  /** Template name, e.g. "Pilar de 4 — 2C" */
  name: string;
  /** Template slug, e.g. "pd4-2c" */
  slug: string;
  description: string;
  hasPinya: boolean;
  direction: number;
  metadata: Record<string, unknown>;
  nodes: NodeSeed[];
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

export async function insertFigure(figure: FigureSeed): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { getRepositoryToken } = await import('@nestjs/typeorm');
  const { AppModule } = await import('../../../../app/app.module');
  const { FigureFamily } = await import('../../../figure/entities/figure-family.entity');
  const { FigureTemplate } = await import('../../../figure/entities/figure-template.entity');
  const { FigureNode } = await import('../../../figure/entities/figure-node.entity');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const familyRepo = app.get<
      import('typeorm').Repository<import('../../figure/entities/figure-family.entity').FigureFamily>
    >(getRepositoryToken(FigureFamily));

    const templateRepo = app.get<
      import('typeorm').Repository<import('../../figure/entities/figure-template.entity').FigureTemplate>
    >(getRepositoryToken(FigureTemplate));

    const nodeRepo = app.get<
      import('typeorm').Repository<import('../../figure/entities/figure-node.entity').FigureNode>
    >(getRepositoryToken(FigureNode));

    // Find or create family
    let family = await familyRepo.findOne({ where: { slug: figure.familySlug } });
    if (!family) {
      family = familyRepo.create({
        name: figure.familyName,
        slug: figure.familySlug,
        description: null,
        metadata: {},
      });
      family = await familyRepo.save(family);
      console.log(`\n  Created family: "${figure.familyName}" (${family.id})`);
    } else {
      console.log(`\n  Using existing family: "${figure.familyName}" (${family.id})`);
    }

    // Check if template slug already exists
    const existing = await templateRepo.findOne({ where: { slug: figure.slug } });
    if (existing) {
      console.log(`\n  Template "${figure.slug}" already exists (id: ${existing.id}).`);
      console.log('  Skipping. Delete it first or change the slug.\n');
      return;
    }

    const template = templateRepo.create({
      family,
      variantOrder:  figure.variantOrder,
      name:          figure.name,
      slug:          figure.slug,
      description:   figure.description,
      hasPinya:      figure.hasPinya,
      direction:     figure.direction,
      metadata:      figure.metadata,
    });
    const saved = await templateRepo.save(template);

    const nodeEntities = figure.nodes.map((n) =>
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
        ringLevel:    n.ringLevel ?? null,
        originNodeId: n.originNodeId ?? null,
        metadata:     n.metadata,
      }),
    );
    await nodeRepo.save(nodeEntities);

    console.log(`\n  Template "${figure.name}" created!`);
    console.log(`  ID:           ${saved.id}`);
    console.log(`  Family:       ${figure.familyName} (order ${figure.variantOrder})`);
    console.log(`  Nodes:        ${nodeEntities.length}`);
    console.log(`\n  Open in dashboard: /pinyes/templates/${saved.id}/edit\n`);
  } finally {
    await app.close();
  }
}

// ---------------------------------------------------------------------------
// Dry-run print
// ---------------------------------------------------------------------------

export function printPayload(figure: FigureSeed): void {
  console.log(`\n=== ${figure.name.toUpperCase()} — JSON PAYLOAD ===\n`);
  console.log(JSON.stringify(figure, null, 2));
  console.log(`\nTotal nodes: ${figure.nodes.length}`);
  console.log('\n=== INSERT ===\n');
  console.log(`  nx run api:seed-figures-${figure.slug} -- --insert\n`);
}
