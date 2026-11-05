/**
 * «Dispositius i sessions» end to end against the local stack (API :3000, dashboard :4200), API + UI.
 * Creates its own accounts (a MEMBER via person + invite, a TECHNICAL via POST /users) in the dev DB
 * and deletes them afterwards. Needs DATABASE_URL (to expire an invite and read audit rows).
 *
 *   set -a; . ./.env; set +a; E2E_EMAIL=... E2E_PASSWORD=... pnpm run e2e:user-devices
 */
import { test, expect, request as pwRequest, Page } from '@playwright/test';
import { UserDevicesSummary } from '@muixer/shared';
import { Client } from 'pg';

const API = 'http://localhost:3000/api';
const ADMIN = { email: process.env['E2E_EMAIL'] ?? '', password: process.env['E2E_PASSWORD'] ?? '' };
const RUN = Date.now().toString(36);
const PASSWORD = 'QaDevices1234!';
const MEMBER_EMAIL = `qa-devices-member-${RUN}@example.com`;
const TECH_EMAIL = `qa-devices-tech-${RUN}@example.com`;
const MEMBER_ALIAS = `QADISP${RUN}`.toUpperCase();
const UA_PWA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const UA_DESK = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const ZERO_UUID = '00000000-0000-4000-8000-000000000000';

const db = new Client({ connectionString: process.env['DATABASE_URL'] });

/** A logged-in API client: its own cookie jar, so refresh rotation works per session. */
async function session(email: string, password: string, clientType: 'dashboard' | 'pwa', ua = UA_DESK) {
  const ctx = await pwRequest.newContext({ baseURL: API, extraHTTPHeaders: { 'user-agent': ua } });
  const res = await ctx.post(`${API}/auth/login`, { data: { email, password, clientType } });
  expect(res.status(), `login ${email}`).toBe(200);
  const token = (await res.json()).accessToken as string;
  return { ctx, token, auth: { authorization: `Bearer ${token}` } };
}
type Session = Awaited<ReturnType<typeof session>>;

const refresh = (s: Session) => s.ctx.post(`${API}/auth/refresh`);

let admin: Session;
let memberUserId: string;
let memberPersonId: string;

async function sessionsOf(userId: string) {
  const r = await admin.ctx.get(`${API}/users/${userId}/sessions`, { headers: admin.auth });
  expect(r.status()).toBe(200);
  return (await r.json()) as Array<{ family: string; clientType: string; userAgent: string | null }>;
}
async function devicesOf(userId: string) {
  const r = await admin.ctx.get(`${API}/users/${userId}/push-subscriptions`, { headers: admin.auth });
  expect(r.status()).toBe(200);
  return (await r.json()) as Array<{ id: string; userAgent: string | null }>;
}
async function summaryRow(search: string) {
  const r = await admin.ctx.get(`${API}/users/devices-summary`, { headers: admin.auth, params: { search } });
  expect(r.status()).toBe(200);
  return (await r.json()).data as UserDevicesSummary[];
}

test.describe('Dispositius i sessions — pla de proves', () => {
  test.beforeAll(async () => {
    await db.connect();
    admin = await session(ADMIN.email, ADMIN.password, 'dashboard');

    // MEMBER: person → invite link → register via invite (PWA user agent).
    const p = await admin.ctx.post(`${API}/persons`, {
      headers: admin.auth,
      data: { name: 'Qa', firstSurname: 'Dispositius', alias: MEMBER_ALIAS },
    });
    expect(p.status(), await p.text()).toBe(201);
    memberPersonId = (await p.json()).id;
    const inv = await admin.ctx.post(`${API}/users/invite-link`, { headers: admin.auth, data: { personId: memberPersonId } });
    expect(inv.status(), await inv.text()).toBe(201);
    const { inviteUrl } = await inv.json();
    const token = new URL(inviteUrl).searchParams.get('token') ?? inviteUrl.split('/').pop();

    // Pending invite shows in the summary before it is accepted.
    const pending = await summaryRow(MEMBER_ALIAS);
    expect(pending[0]?.invite?.status, 'invite PENDING before accept').toBe('PENDING');
    memberUserId = pending[0].userId;

    const invCtx = await pwRequest.newContext({ baseURL: API, extraHTTPHeaders: { 'user-agent': UA_PWA } });
    const reg = await invCtx.post(`${API}/auth/invite/register`, {
      data: {
        token, email: MEMBER_EMAIL, password: PASSWORD, legalAccepted: true,
        name: 'Qa', firstSurname: 'Dispositius', phone: '+34600000000', gender: 'OTHER', birthDate: '1990-01-01',
      },
    });
    expect(reg.status(), await reg.text()).toBe(200);
    await invCtx.dispose();

    // TECHNICAL with no person.
    const t = await admin.ctx.post(`${API}/users`, {
      headers: admin.auth,
      data: { email: TECH_EMAIL, password: PASSWORD, role: 'TECHNICAL' },
    });
    expect(t.status(), await t.text()).toBe(201);
  });

  test.afterAll(async () => {
    // Every account this run created (MEMBER_ALIAS and MEMBER_ALIAS + 'X'); tokens cascade with the user.
    await db.query(
      `CREATE TEMP TABLE qa_u AS SELECT id FROM users WHERE email IN ($1, $2) OR person_id IN (SELECT id FROM persons WHERE alias LIKE $3)`,
      [MEMBER_EMAIL, TECH_EMAIL, `${MEMBER_ALIAS}%`],
    );
    await db.query(`DELETE FROM push_subscriptions WHERE user_id IN (SELECT id FROM qa_u)`);
    await db.query(`DELETE FROM users WHERE id IN (SELECT id FROM qa_u)`);
    await db.query(`DELETE FROM person_positions WHERE "personsId" IN (SELECT id FROM persons WHERE alias LIKE $1)`, [`${MEMBER_ALIAS}%`]);
    await db.query(`DELETE FROM persons WHERE alias LIKE $1`, [`${MEMBER_ALIAS}%`]);
    await db.end();
  });

  // ── API ───────────────────────────────────────────────────────────────
  test('A01 invitació: PENDING → acceptada (null) → EXPIRED', async () => {
    expect((await summaryRow(MEMBER_ALIAS))[0].invite).toBeNull();
    // Second person with an invite forced to expire.
    const p = await admin.ctx.post(`${API}/persons`, { headers: admin.auth, data: { name: 'Qa', firstSurname: 'Caducada', alias: `${MEMBER_ALIAS}X` } });
    const personId = (await p.json()).id;
    await admin.ctx.post(`${API}/users/invite-link`, { headers: admin.auth, data: { personId } });
    await db.query(`UPDATE users SET "inviteExpiresAt" = now() - interval '1 day' WHERE person_id = $1`, [personId]);
    expect((await summaryRow(`${MEMBER_ALIAS}X`))[0]?.invite?.status).toBe('EXPIRED');
  });

  test('A02 permisos: TECHNICAL i MEMBER reben 403 a tot users/*devices*', async () => {
    const tech = await session(TECH_EMAIL, PASSWORD, 'dashboard');
    const member = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    for (const s of [tech, member]) {
      const calls = [
        s.ctx.get(`${API}/users/devices-summary`, { headers: s.auth }),
        s.ctx.get(`${API}/users/${memberUserId}/sessions`, { headers: s.auth }),
        s.ctx.delete(`${API}/users/${memberUserId}/sessions`, { headers: s.auth }),
        s.ctx.delete(`${API}/users/${memberUserId}/sessions/${ZERO_UUID}`, { headers: s.auth }),
        s.ctx.get(`${API}/users/${memberUserId}/push-subscriptions`, { headers: s.auth }),
        s.ctx.delete(`${API}/users/${memberUserId}/push-subscriptions/${ZERO_UUID}`, { headers: s.auth }),
        s.ctx.post(`${API}/users/${memberUserId}/push-subscriptions/${ZERO_UUID}/test`, { headers: s.auth }),
      ];
      for (const r of await Promise.all(calls)) expect(r.status(), r.url()).toBe(403);
    }
    // The member's sessions survived the forbidden revoke.
    expect((await sessionsOf(memberUserId)).length).toBeGreaterThan(0);
  });

  test('A03 acceptar invitació desa el navegador de la primera sessió', async () => {
    const pwa = (await sessionsOf(memberUserId)).filter((s) => s.clientType === 'pwa');
    const first = pwa.at(-1); // oldest
    expect(first?.userAgent, 'invite session userAgent').toBe(UA_PWA);
  });

  test('A04 resum = llista de sessions (membre i admin)', async () => {
    for (const [search, id] of [[MEMBER_ALIAS, memberUserId]] as const) {
      const row = (await summaryRow(search))[0];
      expect(row.activeSessions).toBe((await sessionsOf(id)).length);
    }
    const me = (await summaryRow(ADMIN.email))[0];
    expect(me.activeSessions).toBe((await sessionsOf(me.userId)).length);
  });

  test('A05 ordenació: tots els camps permesos 200, camp no permès 400', async () => {
    for (const sortBy of ['alias', 'email', 'activeSessions', 'activeDevices', 'lastAccessAt', 'lastPushAt']) {
      for (const sortOrder of ['ASC', 'DESC']) {
        const r = await admin.ctx.get(`${API}/users/devices-summary`, { headers: admin.auth, params: { sortBy, sortOrder } });
        expect(r.status(), `${sortBy} ${sortOrder}`).toBe(200);
      }
    }
    const bad = await admin.ctx.get(`${API}/users/devices-summary`, { headers: admin.auth, params: { sortBy: 'passwordHash' } });
    expect(bad.status()).toBe(400);
    const inj = await admin.ctx.get(`${API}/users/devices-summary`, { headers: admin.auth, params: { sortBy: 'email; DROP TABLE users' } });
    expect(inj.status()).toBe(400);
  });

  test('A06 usuari inexistent: 404 i cap auditoria', async () => {
    const before = (await db.query(`SELECT count(*)::int n FROM audit_logs WHERE "targetId" = $1`, [ZERO_UUID])).rows[0].n;
    const del = await admin.ctx.delete(`${API}/users/${ZERO_UUID}/sessions`, { headers: admin.auth });
    const list = await admin.ctx.get(`${API}/users/${ZERO_UUID}/sessions`, { headers: admin.auth });
    const push = await admin.ctx.get(`${API}/users/${ZERO_UUID}/push-subscriptions`, { headers: admin.auth });
    const after = (await db.query(`SELECT count(*)::int n FROM audit_logs WHERE "targetId" = $1`, [ZERO_UUID])).rows[0].n;
    expect.soft(del.status(), 'DELETE sessions').toBe(404);
    expect.soft(list.status(), 'GET sessions').toBe(404);
    expect.soft(push.status(), 'GET push-subscriptions').toBe(404);
    expect.soft(after - before, 'audit rows written').toBe(0);
    const bad = await admin.ctx.get(`${API}/users/not-a-uuid/sessions`, { headers: admin.auth });
    expect.soft(bad.status(), 'non-uuid id').toBe(400);
  });

  test('A07 fer expirar una sessió: la seua cookie mor, les altres no; auditat', async () => {
    const a = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    const before = new Set((await sessionsOf(memberUserId)).map((x) => x.family));
    const b = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_DESK);
    const fam = (await sessionsOf(memberUserId)).find((x) => !before.has(x.family))?.family ?? '';
    const r = await admin.ctx.delete(`${API}/users/${memberUserId}/sessions/${fam}`, { headers: admin.auth });
    expect(r.status()).toBe(204);
    expect((await refresh(b)).status(), 'revoked session refresh').toBe(401);
    expect((await refresh(a)).status(), 'other session refresh').toBe(200);
    const audit = await db.query(`SELECT count(*)::int n FROM audit_logs WHERE "targetId" = $1 AND action = 'USER_SESSIONS_REVOKED'`, [memberUserId]);
    expect(audit.rows[0].n).toBeGreaterThan(0);
    // Double click: the second revoke of the same family.
    const again = await admin.ctx.delete(`${API}/users/${memberUserId}/sessions/${fam}`, { headers: admin.auth });
    expect.soft(again.status(), 'second revoke of an already revoked family').toBe(404);
  });

  test('A08 fer expirar totes: cap refresc funciona; el token d’accés viu fins a 15 min', async () => {
    const a = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    const b = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    const r = await admin.ctx.delete(`${API}/users/${memberUserId}/sessions`, { headers: admin.auth });
    expect(r.status()).toBe(204);
    expect((await refresh(a)).status()).toBe(401);
    expect((await refresh(b)).status()).toBe(401);
    expect(await sessionsOf(memberUserId)).toHaveLength(0);
    const me = await a.ctx.get(`${API}/auth/me`, { headers: a.auth });
    expect(me.status(), 'access token still valid (documented: up to 15 min)').toBe(200);
  });

  test('A09 cursa refresc ↔ fer expirar: la sessió no ha de sobreviure', async () => {
    let survived = 0;
    const N = 25;
    for (let i = 0; i < N; i++) {
      const before = new Set((await sessionsOf(memberUserId)).map((x) => x.family));
      const s = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
      const fam = (await sessionsOf(memberUserId)).find((x) => !before.has(x.family))?.family ?? '';
      await Promise.all([refresh(s), admin.ctx.delete(`${API}/users/${memberUserId}/sessions/${fam}`, { headers: admin.auth })]);
      const r2 = await refresh(s);
      if (r2.status() === 200) survived++;
      await s.ctx.dispose();
    }
    console.log(`A09 survived ${survived}/${N}`);
    expect(survived, 'revoked sessions that kept refreshing').toBe(0);
  });

  test('A10 dispositius: registra, prova, elimina; i la PWA el torna a registrar', async () => {
    const m = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    const endpoint = `https://fcm.googleapis.com/fcm/send/qa-${RUN}`;
    const sub = { endpoint, keys: { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }, userAgent: UA_PWA };
    expect((await m.ctx.post(`${API}/me/push-subscriptions`, { headers: m.auth, data: sub })).status()).toBe(201);
    const list = await devicesOf(memberUserId);
    expect(list).toHaveLength(1);
    const id = list[0].id;

    const t = await admin.ctx.post(`${API}/users/${memberUserId}/push-subscriptions/${id}/test`, { headers: admin.auth });
    expect([200, 201]).toContain(t.status());
    console.log('A10 test push →', t.status(), await t.text());
    const audit = await db.query(`SELECT count(*)::int n FROM audit_logs WHERE action = 'PUSH_SUBSCRIPTION_TESTED' AND "createdAt" > now() - interval '1 minute'`).catch(() => ({ rows: [{ n: -1 }] }));
    expect.soft(audit.rows[0].n, 'PUSH_SUBSCRIPTION_TESTED audited').not.toBe(0);

    expect((await admin.ctx.delete(`${API}/users/${memberUserId}/push-subscriptions/${id}`, { headers: admin.auth })).status()).toBe(204);
    expect(await devicesOf(memberUserId)).toHaveLength(0);
    // Unknown device id for this user → 404.
    expect((await admin.ctx.delete(`${API}/users/${memberUserId}/push-subscriptions/${ZERO_UUID}`, { headers: admin.auth })).status()).toBe(404);

    // What PWA syncOnStartup sees and does next.
    const status = await (await m.ctx.get(`${API}/me/push-subscriptions/status`, { headers: m.auth })).json();
    console.log('A10 status after admin removal →', JSON.stringify(status));
    if (!status.isSubscribed) {
      // = syncOnStartup() → subscribeAndRegister(silent)
      const silent = await m.ctx.post(`${API}/me/push-subscriptions`, { headers: m.auth, data: { ...sub, silent: true } });
      expect((await silent.json()).isActive).toBe(false);
    }
    expect(await devicesOf(memberUserId), 'admin removal must stick after the PWA restarts').toHaveLength(0);
    // The member turning notifications on again by hand re-enables it.
    await m.ctx.post(`${API}/me/push-subscriptions`, { headers: m.auth, data: sub });
    expect(await devicesOf(memberUserId), 'explicit opt-in re-enables').toHaveLength(1);
  });

  // ── Dashboard UI ──────────────────────────────────────────────────────
  async function loginUi(page: Page, email: string, password: string) {
    await page.goto('/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).not.toHaveURL(/\/login/, { timeout: 15000 });
  }
  /** Client-side navigation: a reload would drop the in-memory access token. */
  async function nav(page: Page, path: string) {
    await page.evaluate((p) => { history.pushState({}, '', p); dispatchEvent(new PopStateEvent('popstate')); }, path);
  }
  const toasts = (page: Page) => page.getByTestId('lib-toast-item');
  /** Rows whose alias is exactly MEMBER_ALIAS (A01 also creates MEMBER_ALIAS + 'X'). */
  const memberRows = (page: Page) =>
    page.locator('app-data-table tbody tr').filter({ has: page.locator('td[data-col="alias"]', { hasText: new RegExp(`^\\s*${MEMBER_ALIAS}\\s*$`) }) });

  test('U01 ADMIN: enllaços, cerca, finestra, fer expirar, comptadors', async ({ page }) => {
    await admin.ctx.delete(`${API}/users/${memberUserId}/sessions`, { headers: admin.auth });
    await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA); // exactly 1 open session
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users');
    await page.getByRole('button', { name: 'Dispositius i sessions' }).or(page.getByRole('link', { name: 'Dispositius i sessions' })).first().click();
    await expect(page).toHaveURL(/\/config\/users\/devices/);
    await expect(page.getByRole('heading', { name: 'Dispositius i sessions' })).toBeVisible();

    await page.locator('app-user-devices-list input[placeholder^="Àlies"]').fill(MEMBER_ALIAS);
    const rows = memberRows(page);
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td[data-col="activeSessions"]')).toHaveText(/^\s*1\s*$/);
    await rows.first().click();
    const dlg = page.locator('dialog[open]');
    await expect(dlg.getByRole('heading', { name: new RegExp(MEMBER_ALIAS) })).toBeVisible();
    await expect(dlg.getByTestId('session-row')).toHaveCount(1);
    await expect(dlg.getByTestId('session-row').first()).toContainText('Safari · iOS');
    await dlg.getByRole('button', { name: 'Fes expirar', exact: true }).click();
    await expect(toasts(page).filter({ hasText: "S'ha fet expirar la sessió." })).toBeVisible();
    await expect(dlg.getByText('Cap sessió oberta.')).toBeVisible();
    await dlg.getByRole('button', { name: 'Tanca' }).last().click();
    await expect(rows.first().locator('td[data-col="activeSessions"]')).toHaveText(/^\s*0\s*$/);
  });

  test('U02 ADMIN: doble clic a «Fes expirar» no mostra error', async ({ page }) => {
    await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users/devices');
    await page.locator('app-user-devices-list input[placeholder^="Àlies"]').fill(MEMBER_ALIAS);
    await expect(memberRows(page)).toHaveCount(1);
    await memberRows(page).first().click();
    const btn = page.locator('dialog[open]').getByRole('button', { name: 'Fes expirar', exact: true }).first();
    await btn.dblclick();
    await expect(toasts(page).filter({ hasText: "S'ha fet expirar la sessió." })).toBeVisible();
    await expect(toasts(page).filter({ hasText: "No s'ha pogut" }), 'error toast after double click').toHaveCount(0);
  });

  test('U03 ADMIN: «Envia una prova» i «Elimina» a la finestra', async ({ page }) => {
    const m = await session(MEMBER_EMAIL, PASSWORD, 'pwa', UA_PWA);
    for (const d of await devicesOf(memberUserId)) {
      await admin.ctx.delete(`${API}/users/${memberUserId}/push-subscriptions/${d.id}`, { headers: admin.auth });
    }
    const endpoint = `https://fcm.googleapis.com/fcm/send/qa-ui-${RUN}`;
    await m.ctx.post(`${API}/me/push-subscriptions`, { headers: m.auth, data: { endpoint, keys: { p256dh: 'x'.repeat(20), auth: 'y'.repeat(10) }, userAgent: UA_PWA } });
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users/devices');
    await page.locator('app-user-devices-list input[placeholder^="Àlies"]').fill(MEMBER_ALIAS);
    await expect(memberRows(page)).toHaveCount(1);
    await memberRows(page).first().click();
    const dlg = page.locator('dialog[open]');
    await expect(dlg.getByTestId('device-row')).toHaveCount(1);
    await dlg.getByRole('button', { name: 'Envia una prova' }).click();
    await expect(toasts(page).first()).toBeVisible();
    console.log('U03 test toast →', await toasts(page).first().innerText());
    await dlg.getByRole('button', { name: 'Elimina' }).click();
    await expect(dlg.getByText('Cap dispositiu rep notificacions.')).toBeVisible();
  });

  test('U04 ADMIN: compte sense persona mostra el correu al títol', async ({ page }) => {
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users/devices');
    await page.locator('app-user-devices-list input[placeholder^="Àlies"]').fill(TECH_EMAIL);
    await expect(page.locator('app-data-table tbody tr')).toHaveCount(1);
    await page.locator('app-data-table tbody tr').first().click();
    await expect(page.locator('dialog[open]').getByRole('heading', { name: new RegExp(TECH_EMAIL) })).toBeVisible();
  });

  test('U05 ADMIN: una resposta de cerca antiga no sobreescriu la nova', async ({ page }) => {
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users/devices');
    // Delay only the first, broader search so it lands after the precise one.
    await page.route('**/api/users/devices-summary?*search=QADISP&*', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue();
    });
    const input = page.locator('app-user-devices-list input[placeholder^="Àlies"]');
    const slow = page.waitForResponse((r) => r.url().includes('search=QADISP'));
    const sent = page.waitForRequest((r) => r.url().includes('search=QADISP'));
    await input.fill('QADISP');
    await sent; // first (slow) request is in flight
    await input.fill(MEMBER_ALIAS);
    await slow; // stale response has landed; table must still show the current search
    const rows = page.locator('app-data-table tbody tr');
    const texts = await rows.locator('td[data-col="alias"]').allInnerTexts();
    console.log('U05 rows shown for search', MEMBER_ALIAS, '→', JSON.stringify(texts.map((t) => t.trim())));
    expect(texts.every((t) => t.trim().startsWith(MEMBER_ALIAS)) && texts.length <= 2, 'table matches the current search').toBe(true);
  });

  test('U06 ADMIN: mòbil (targetes sota lg)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginUi(page, ADMIN.email, ADMIN.password);
    await nav(page, '/config/users/devices');
    await expect(page.getByRole('heading', { name: 'Dispositius i sessions' })).toBeVisible();
    const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollW, 'no horizontal scroll').toBeLessThanOrEqual(390);
      });

  test('U07 TECHNICAL: cap accés ni enllaç a dispositius', async ({ page }) => {
    await loginUi(page, TECH_EMAIL, PASSWORD);
    await nav(page, '/config/users');
    console.log('U07 /config/users →', page.url());
    await expect(page.getByText('Dispositius i sessions')).toHaveCount(0);
    await nav(page, '/communication');
    console.log('U07 /communication →', page.url());
    await expect(page.getByText('Dispositius i sessions')).toHaveCount(0);
    await nav(page, '/config/users/devices');
    console.log('U07 /config/users/devices →', page.url());
    await expect(page).toHaveURL(/\/home$/);
    await nav(page, '/home');
    console.log('U07 /home afterwards →', page.url());
    await expect(page, 'still logged in after the blocked route').not.toHaveURL(/\/login/);
    await nav(page, '/communication/notifications/devices');
    await expect(page).toHaveURL(/\/home$/);
    console.log('U07 TECHNICAL lands on', page.url());
  });
});
