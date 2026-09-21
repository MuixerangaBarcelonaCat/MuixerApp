import { Page, Route } from '@playwright/test';

/**
 * Hermetic backend for the touch-assignment e2e. Every `/api/**` request the dashboard makes is
 * answered here, in the browser, by Playwright's request interception — nothing reaches the real
 * API or database (the dashboard's `apiUrl` is an absolute cross-origin URL, and interception
 * happens before the network). That means the suite needs no credentials, never touches dev data,
 * and always starts from the same figure.
 *
 * It is a tiny in-memory backend, not canned responses: assign / unassign / swap change the
 * assignments it serves next, so a whole move can be checked by what the UI shows afterwards.
 */

export const EVENT_ID = 'e2e-event';
export const SEGMENT_ID = 'e2e-segment';
export const INSTANCE_ID = 'e2e-figure';

export const WORKSPACE_URL = `/pinyes/events/${EVENT_ID}/segments/${SEGMENT_ID}/assign`;

interface Person {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
}

interface NodeDef {
  id: string;
  zone: 'PINYA' | 'TRONC';
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
}

interface Assignment {
  id: string;
  nodeId: string;
  personId: string;
}

/**
 * One figure, laid out so both renderers can be driven deterministically:
 * - Pinya: three 100-unit nodes on a row that fits a phone at 100% zoom (the middle one is at the
 *   exact centre of the content, so the canvas centres on it).
 * - Tronc: three nodes on one floor.
 */
export const PERSONS: Person[] = [
  { id: 'p-pepet', alias: 'Pepet', name: 'Josep', firstSurname: 'Puig' },
  { id: 'p-maria', alias: 'Maria', name: 'Maria', firstSurname: 'Vila' },
  { id: 'p-josep', alias: 'Josep', name: 'Josep', firstSurname: 'Roca' },
  { id: 'p-anna', alias: 'Anna', name: 'Anna', firstSurname: 'Soler' },
];

const NODES: NodeDef[] = [
  { id: 'pinya-a', zone: 'PINYA', x: 0, y: 0, z: 0, width: 100, height: 100 },
  { id: 'pinya-b', zone: 'PINYA', x: 120, y: 0, z: 0, width: 100, height: 100 },
  { id: 'pinya-c', zone: 'PINYA', x: 240, y: 0, z: 0, width: 100, height: 100 },
  { id: 'tronc-1', zone: 'TRONC', x: 0, y: 0, z: 1, width: 1, height: 1 },
  { id: 'tronc-2', zone: 'TRONC', x: 1, y: 0, z: 1, width: 1, height: 1 },
  { id: 'tronc-3', zone: 'TRONC', x: 2, y: 0, z: 1, width: 1, height: 1 },
];

/** Who stands where when a test starts. `pinya-a`, `pinya-c`, `tronc-2` are empty; Anna is free. */
const INITIAL_ASSIGNMENTS: Assignment[] = [
  { id: 'as-pinya-b', nodeId: 'pinya-b', personId: 'p-pepet' },
  { id: 'as-tronc-1', nodeId: 'tronc-1', personId: 'p-maria' },
  { id: 'as-tronc-3', nodeId: 'tronc-3', personId: 'p-josep' },
];

export interface ApiCall {
  method: string;
  path: string;
  body: unknown;
}

export interface MockApi {
  /** Every mutating call (POST / DELETE) the app made, in order. */
  mutations(): ApiCall[];
  /** Requests nobody mocked — a test can assert this stays empty. */
  unmocked(): string[];
  /** Alias of the person standing on `nodeId`, or null. */
  occupant(nodeId: string): string | null;
}

const CORS = {
  'access-control-allow-origin': 'http://localhost:4200',
  'access-control-allow-credentials': 'true',
  'access-control-allow-headers': 'authorization,content-type',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export async function installMockApi(page: Page): Promise<MockApi> {
  let assignments: Assignment[] = INITIAL_ASSIGNMENTS.map((a) => ({ ...a }));
  let seq = 0;
  const mutations: ApiCall[] = [];
  const unmocked: string[] = [];

  const person = (id: string) => PERSONS.find((p) => p.id === id) as Person;
  const node = (id: string) => NODES.find((n) => n.id === id) as NodeDef;
  const areaOf = (n: NodeDef) => (n.zone === 'TRONC' ? 'TRONC' : 'PINYA');

  const nodeItem = (n: NodeDef, index: number) => ({
    id: n.id,
    label: n.id,
    zone: n.zone,
    positionType: null,
    x: n.x,
    y: n.y,
    z: n.z,
    width: n.width,
    height: n.height,
    rotation: 0,
    color: null,
    shape: 'RECTANGLE',
    sortOrder: index,
    climbIndicator: null,
    ringLevel: null,
    originNodeId: null,
    renglaId: null,
    renglaPosition: null,
    sourceNodeId: null,
    isSnapshotted: true,
    isAdHoc: false,
    createdById: null,
  });

  const assignmentDetail = (a: Assignment) => {
    const n = node(a.nodeId);
    const p = person(a.personId);
    return {
      id: a.id,
      figureInstanceId: INSTANCE_ID,
      node: {
        id: n.id,
        label: n.id,
        zone: n.zone,
        z: n.z,
        positionType: null,
        sortOrder: NODES.indexOf(n),
        climbIndicator: null,
        ringLevel: null,
        originNodeId: null,
        sourceNodeId: null,
      },
      person: {
        id: p.id,
        alias: p.alias,
        name: p.name,
        firstSurname: p.firstSurname,
        shoulderHeight: null,
        notes: null,
        notesEmoji: null,
      },
    };
  };

  const availablePerson = (p: Person) => {
    const mine = assignments.filter((a) => a.personId === p.id);
    return {
      id: p.id,
      alias: p.alias,
      name: p.name,
      firstSurname: p.firstSurname,
      shoulderHeight: null,
      isXicalla: false,
      notes: null,
      notesEmoji: null,
      attendanceStatus: 'ANIRE',
      nextPerformanceStatus: null,
      assignedPlacements: mine.map((a) => ({
        assignmentId: a.id,
        figureInstanceId: INSTANCE_ID,
        figureName: 'Figura e2e',
        nodeId: a.nodeId,
        nodeLabel: a.nodeId,
        zone: node(a.nodeId).zone,
        area: areaOf(node(a.nodeId)),
        z: node(a.nodeId).z,
        renglaPosition: null,
        cordon: null,
      })),
      assignedInTronc: mine.some((a) => node(a.nodeId).zone === 'TRONC'),
      assignedInPinya: mine.some((a) => node(a.nodeId).zone === 'PINYA'),
      conflictInSegment: false,
      positions: [],
    };
  };

  const segment = () => ({
    id: SEGMENT_ID,
    name: 'Bloc e2e',
    sortOrder: 0,
    startTime: null,
    endTime: null,
    notes: null,
    isPublished: true,
    instances: [
      {
        id: INSTANCE_ID,
        label: 'Figura e2e',
        sortOrder: 0,
        snapshotted: true,
        assignedCount: assignments.length,
        pinyaAssignedCount: assignments.filter((a) => node(a.nodeId).zone === 'PINYA').length,
        totalCordons: null,
        numberOfCordons: null,
        cordonsObertsEnabled: true,
        projectionX: null,
        projectionY: null,
        projectionScale: 1,
        figureMode: 'COMPLETA',
        figureTemplate: { id: 'tpl-e2e', name: 'Figura e2e', hasPinya: true },
      },
    ],
  });

  const conflicts = () => ({
    data: [],
    meta: {
      assignmentCount: assignments.length,
      distinctPersonCount: new Set(assignments.map((a) => a.personId)).size,
      tronc: { distinctPersonCount: 0 },
      pinya: { distinctPersonCount: 0 },
      conflictPersonCount: 0,
      conflictsByKind: {},
    },
  });

  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });

  // The dashboard skips its bootstrap silent-refresh unless this hint says a session exists.
  await page.addInitScript(() => localStorage.setItem('muixer_has_session', '1'));

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^\/api/, '');
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }

    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });

    // ── auth ──────────────────────────────────────────────────────────────
    if (method === 'POST' && (path === '/auth/refresh' || path === '/auth/login')) {
      return json(route, {
        accessToken: 'e2e-access-token',
        user: {
          id: 'u-e2e',
          email: 'e2e@example.test',
          role: 'ADMIN',
          isActive: true,
          privacyPolicyAcceptedAt: '2026-01-01T00:00:00.000Z',
          requiresPrivacyConsent: false,
          person: null,
        },
      });
    }
    if (method === 'POST' && path.startsWith('/auth/logout')) return route.fulfill({ status: 204, headers: CORS });

    // ── workspace reads ───────────────────────────────────────────────────
    if (method === 'GET' && path === `/events/${EVENT_ID}/segments`) return json(route, { data: [segment()] });
    if (method === 'GET' && path === `/events/${EVENT_ID}/segments/${SEGMENT_ID}/distribution`) {
      return json(route, { segment: { id: SEGMENT_ID, name: 'Bloc e2e' }, items: [] });
    }
    if (method === 'GET' && path === `/events/${EVENT_ID}/lock-status`) {
      return json(route, { locked: false, lockDate: null, lockDays: 3 });
    }
    if (method === 'GET' && path === `/events/${EVENT_ID}/segments/${SEGMENT_ID}/conflicts`) return json(route, conflicts());
    if (method === 'GET' && path === `/events/${EVENT_ID}/segments/${SEGMENT_ID}/available-persons`) {
      return json(route, { data: PERSONS.map(availablePerson) });
    }
    if (method === 'GET' && path === `/figure-instances/${INSTANCE_ID}/nodes`) {
      return json(route, { data: NODES.map(nodeItem) });
    }
    if (method === 'GET' && path === `/figure-instances/${INSTANCE_ID}/assignments`) {
      return json(route, { data: assignments.map(assignmentDetail) });
    }
    if (method === 'GET' && path === '/tags') return json(route, []);

    // ── writes ────────────────────────────────────────────────────────────
    if (method === 'POST' && path === `/figure-instances/${INSTANCE_ID}/assignments`) {
      const { nodeId, personId } = body as { nodeId: string; personId: string };
      mutations.push({ method, path, body });
      const created: Assignment = { id: `as-new-${++seq}`, nodeId, personId };
      assignments.push(created);
      return json(route, assignmentDetail(created), 201);
    }
    const deleteMatch = path.match(new RegExp(`^/figure-instances/${INSTANCE_ID}/assignments/([^/]+)$`));
    if (method === 'DELETE' && deleteMatch) {
      mutations.push({ method, path, body });
      assignments = assignments.filter((a) => a.id !== deleteMatch[1]);
      return json(route, {});
    }
    if (method === 'POST' && path === `/figure-instances/${INSTANCE_ID}/assignments/swap`) {
      const { assignmentIdA, assignmentIdB } = body as { assignmentIdA: string; assignmentIdB: string };
      mutations.push({ method, path, body });
      const a = assignments.find((x) => x.id === assignmentIdA);
      const b = assignments.find((x) => x.id === assignmentIdB);
      if (a && b) [a.personId, b.personId] = [b.personId, a.personId];
      return json(route, { a: a && assignmentDetail(a), b: b && assignmentDetail(b) });
    }

    unmocked.push(`${method} ${path}`);
    return json(route, { message: `not mocked: ${method} ${path}` }, 404);
  });

  return {
    mutations: () => [...mutations],
    unmocked: () => [...unmocked],
    occupant: (nodeId) => {
      const a = assignments.find((x) => x.nodeId === nodeId);
      return a ? person(a.personId).alias : null;
    },
  };
}
