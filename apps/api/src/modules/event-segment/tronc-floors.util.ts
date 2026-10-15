import { DataSource } from 'typeorm';

export interface TroncFloorData {
  z: number;
  isBase: boolean;
  slots: (string | null)[];
}

interface TroncNodeRow {
  instance_id: string;
  zone: string;
  z: number;
  sort_order: number;
  alias: string | null;
  climb_indicator: string | null;
}

/**
 * Tronc/base floors per instance — the input to `formatTroncSummary` — for every instance of an
 * event, or for an explicit set of instances. Shared by the segment list's Troncs mode and the
 * import modal's history so both word a tronc identically. Empty slots come back as null.
 */
export async function fetchTroncFloors(
  dataSource: DataSource,
  scope: { eventId: string } | { instanceIds: string[] },
): Promise<Map<string, TroncFloorData[]>> {
  if ('instanceIds' in scope && scope.instanceIds.length === 0) return new Map();

  const [where, param] =
    'eventId' in scope
      ? ['es."eventId" = $1', scope.eventId]
      : ['in_."figureInstanceId" = ANY($1)', scope.instanceIds];

  const rows: TroncNodeRow[] = await dataSource.query(
    `SELECT
       in_."figureInstanceId" as instance_id,
       in_.zone,
       in_.z,
       in_."sortOrder" as sort_order,
       p.alias,
       in_."climbIndicator" as climb_indicator
     FROM instance_nodes in_
     JOIN figure_instances fi ON fi.id = in_."figureInstanceId"
     JOIN event_segments es ON es.id = fi."segmentId"
     LEFT JOIN node_assignments na ON na."instanceNodeId" = in_.id AND na."figureInstanceId" = in_."figureInstanceId"
     LEFT JOIN persons p ON p.id = na."personId"
     WHERE ${where}
     AND in_.zone IN ('TRONC', 'BASE')
     ORDER BY in_."figureInstanceId", in_.z, in_."sortOrder"`,
    [param],
  );

  const byInstance = new Map<string, TroncNodeRow[]>();
  for (const row of rows) {
    if (!byInstance.has(row.instance_id)) byInstance.set(row.instance_id, []);
    byInstance.get(row.instance_id)!.push(row);
  }

  const result = new Map<string, TroncFloorData[]>();

  for (const [instanceId, nodeRows] of byInstance) {
    const byFloor = new Map<number, { isBase: boolean; slots: (string | null)[] }>();

    for (const row of nodeRows) {
      const isBase = row.zone === 'BASE';
      const key = isBase ? -1 : row.z;
      if (!byFloor.has(key)) byFloor.set(key, { isBase, slots: [] });
      const label = row.climb_indicator ? `${row.alias ?? '?'} (${row.climb_indicator})` : row.alias ?? null;
      byFloor.get(key)!.slots.push(label);
    }

    const floors: TroncFloorData[] = Array.from(byFloor.entries())
      .map(([key, { isBase, slots }]) => ({ z: isBase ? 0 : key, isBase, slots }))
      .sort((a, b) => (a.isBase ? -1 : b.isBase ? 1 : a.z - b.z));

    result.set(instanceId, floors);
  }

  return result;
}
