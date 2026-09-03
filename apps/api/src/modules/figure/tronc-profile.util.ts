import { Repository } from 'typeorm';
import { FigureZone } from '@muixer/shared';
import { FigureNode } from './entities/figure-node.entity';
import { Logger } from '@nestjs/common';

/**
 * People per tronc/base floor, bottom-to-top (index 0 = bases). Pinya is never included.
 * Shared between FigureTemplateService (list/detail) and CompositionService (list) —
 * both need "how tall/wide is this figure's tronc" without drawing the pinya.
 */

/** Folds a z → people-count map into a dense bottom-to-top array, filling any gap floors with 0. */
export function buildTroncProfile(byZ: Map<number, number>): number[] {
  if (byZ.size === 0) return [];
  const maxZ = Math.max(...byZ.keys());
  const profile: number[] = [];
  for (let z = 0; z <= maxZ; z++) profile.push(byZ.get(z) ?? 0);
  return profile;
}

/** Computes a template's troncProfile from already-loaded FigureNode entities (detail view). */
export function computeTroncProfileFromNodes(
  nodes: Pick<FigureNode, 'zone' | 'z' | 'width'>[],
): number[] {
  const byZ = new Map<number, number>();
  for (const n of nodes) {
    if (n.zone !== FigureZone.TRONC && n.zone !== FigureZone.BASE) continue;
    byZ.set(n.z, (byZ.get(n.z) ?? 0) + 1);
  }
  return buildTroncProfile(byZ);
}

/**
 * People per tronc/base floor for each given template, via one grouped aggregate query —
 * not N+1 — for use on list endpoints where nodes aren't otherwise loaded.
 */
export async function loadTroncProfiles(
  nodeRepository: Repository<FigureNode>,
  templateIds: string[],
): Promise<Map<string, number[]>> {
  const profiles = new Map<string, number[]>();
  if (templateIds.length === 0) return profiles;

  const rows = await nodeRepository
    .createQueryBuilder('node')
    .select('node.templateId', 'templateId')
    .addSelect('node.z', 'z')
    .addSelect(`SUM(1)`, 'count')
    .where('node.templateId IN (:...ids)', { ids: templateIds })
    .andWhere('node.zone IN (:...zones)', { zones: [FigureZone.TRONC, FigureZone.BASE] })
    .groupBy('node.templateId')
    .addGroupBy('node.z')
    .getRawMany<{ templateId: string; z: number; count: string }>();

  const byTemplate = new Map<string, Map<number, number>>();
  for (const row of rows) {
    const byZ = byTemplate.get(row.templateId) ?? new Map<number, number>();
    byZ.set(Number(row.z), Number(row.count));
    byTemplate.set(row.templateId, byZ);
  }
  for (const [templateId, byZ] of byTemplate) {
    profiles.set(templateId, buildTroncProfile(byZ));
  }
  return profiles;
}
