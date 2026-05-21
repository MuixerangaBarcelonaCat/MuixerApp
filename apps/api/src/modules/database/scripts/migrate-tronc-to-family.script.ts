/**
 * Migration: move TRONC and BASE nodes from figure_nodes (template level)
 * into figure_family_nodes (family level).
 *
 * For each FigureFamily, takes the TRONC/BASE nodes from the lowest
 * variantOrder template and inserts them into figure_family_nodes,
 * then removes all TRONC/BASE rows from figure_nodes.
 *
 * Safe to run multiple times (idempotent: skips families that already have
 * family nodes, only deletes figure_nodes rows with zone IN ('TRONC','BASE')).
 *
 * Usage:
 *   nx run api:migrate-tronc-to-family
 */

import 'reflect-metadata';

async function run(): Promise<void> {
  const { NestFactory } = await import('@nestjs/core');
  const { getRepositoryToken } = await import('@nestjs/typeorm');
  const { AppModule } = await import('../../../app/app.module');
  const { FigureFamily } = await import('../../figure/entities/figure-family.entity');
  const { FigureTemplate } = await import('../../figure/entities/figure-template.entity');
  const { FigureNode } = await import('../../figure/entities/figure-node.entity');
  const { FigureFamilyNode } = await import('../../figure/entities/figure-family-node.entity');

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

    const familyNodeRepo = app.get<
      import('typeorm').Repository<import('../../figure/entities/figure-family-node.entity').FigureFamilyNode>
    >(getRepositoryToken(FigureFamilyNode));

    const families = await familyRepo.find();
    console.log(`\nFound ${families.length} families to process.\n`);

    let totalMigrated = 0;
    let totalSkipped = 0;

    for (const family of families) {
      const existingFamilyNodeCount = await familyNodeRepo.count({
        where: { family: { id: family.id } },
      });

      if (existingFamilyNodeCount > 0) {
        console.log(`  [SKIP] "${family.name}" — already has ${existingFamilyNodeCount} family node(s).`);
        totalSkipped++;
        continue;
      }

      // Find the template with the lowest variantOrder for this family
      const sourceTemplate = await templateRepo
        .createQueryBuilder('t')
        .leftJoinAndSelect('t.nodes', 'nodes')
        .where('t.familyId = :familyId', { familyId: family.id })
        .orderBy('t.variantOrder', 'ASC')
        .getOne();

      if (!sourceTemplate) {
        console.log(`  [SKIP] "${family.name}" — no templates found.`);
        totalSkipped++;
        continue;
      }

      const troncBaseNodes = (sourceTemplate.nodes ?? []).filter(
        (n) => n.zone === 'TRONC' || n.zone === 'BASE',
      );

      if (troncBaseNodes.length === 0) {
        console.log(`  [SKIP] "${family.name}" — no TRONC/BASE nodes in lowest variant.`);
        totalSkipped++;
        continue;
      }

      const newFamilyNodes = troncBaseNodes.map((node) =>
        familyNodeRepo.create({
          family,
          label: node.label,
          zone: node.zone,
          positionType: node.positionType,
          x: node.x,
          y: node.y,
          z: node.z,
          width: node.width,
          height: node.height,
          rotation: node.rotation,
          color: node.color,
          shape: node.shape,
          sortOrder: node.sortOrder,
          climbPath: node.climbPath,
          ringLevel: node.ringLevel,
          metadata: node.metadata,
        }),
      );

      await familyNodeRepo.save(newFamilyNodes);
      console.log(`  [OK]   "${family.name}" — migrated ${newFamilyNodes.length} node(s) from template "${sourceTemplate.slug}".`);
      totalMigrated++;
    }

    // Delete ALL TRONC/BASE rows from figure_nodes across all templates
    const deleteResult = await nodeRepo
      .createQueryBuilder()
      .delete()
      .where('zone IN (:...zones)', { zones: ['TRONC', 'BASE'] })
      .execute();

    console.log(`\nDeleted ${deleteResult.affected ?? 0} TRONC/BASE row(s) from figure_nodes.`);
    console.log(`\nDone — migrated: ${totalMigrated}, skipped: ${totalSkipped}\n`);
  } finally {
    await app.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
