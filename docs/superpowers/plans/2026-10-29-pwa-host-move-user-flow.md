# Canvi de host de la PWA — flux dels membres i tancament del host vell

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que cada membre passe de `app.beta.muixerangabarcelona.cat` a `app-beta.muixerangabarcelona.cat` sense quedar-se encallat (tant si té l'app instal·lada, com si entra per primera vegada o per un enllaç d'invitació) i saber quan es pot tancar el host vell.

**Architecture:** Partim del que ja hi ha a `develop` (commit `d1ce4044`): Caddy servix els dos hosts, `/app-host.txt` torna `PWA_PUBLIC_URL` i la PWA mostra `HostMovedComponent` si s'executa en un altre host. Este pla tapa els forats que deixa eixe primer pas (enllaços d'invitació vells, apps instal·lades que obrin el link dins d'un navegador intern, notificacions duplicades, bàner d'instal·lació que no ix després d'activar el compte) i descriu la fase 2 (redirecció) amb un criteri mesurable per a fer-la.

**Tech Stack:** Angular 21 (PWA, Vitest), Caddy 2, Docker Compose pre.

**Spec:** este mateix document (secció «Anàlisi» i «Fluxos»); runbook existent a [docs/DEPLOY_PRE.md](../../DEPLOY_PRE.md) «Canvi de host de la PWA».

---

## Anàlisi del problema

Una PWA instal·lada queda lligada al seu **origen** (esquema + host + port). El `manifest.webmanifest` té `"id": "/"`, però l'`id` es resol contra l'origen: al host nou és una altra app. Conseqüències:

| Què | Per què es perd | Efecte |
|---|---|---|
| App instal·lada | El navegador no pot migrar-la d'origen | Cal instal·lar-la de nou i esborrar la vella |
| Sessió | Cookie `muixer_rt` (host-only) i `localStorage` (`muixer_has_session`) són per origen | Cal tornar a iniciar la sessió |
| Notificacions | La subscripció push és per origen | Cal tornar a activar-les; **la vella seguix rebent avisos** fins que es desactive → avisos duplicats |
| Bàner d'instal·lació | `muixer_login_count` és per origen | Al host nou ix després del primer login (correcte), però **no** després d'activar un compte per invitació (`registerViaInvite` no crida `registerLogin()`) |

Forats detectats en el pas ja desplegat:

1. **Enllaços d'invitació emesos abans del canvi** (caduquen a les 72 h) apunten al host vell. `/activate?token=…` al host vell mostra la pantalla bloquejant i el botó porta a l'arrel del host nou: **es perd el token**. `movedHostUrl` ha de conservar ruta i query.
2. **«Obre la nova app» des de l'app instal·lada** (mode `standalone`) no obri el navegador real: a iPhone s'obri un Safari intern (sense «Afegeix a l'inici») i a Android una pestanya personalitzada de Chrome (sense `beforeinstallprompt`, així que el bàner «Instal·la» no ix). El membre arriba al host nou però **no pot instal·lar** des d'allí. Cal dir-li com passar al navegador i donar-li l'adreça per a copiar.
3. **iPhone: l'app instal·lada no compartix dades amb Safari.** Iniciar la sessió a Safari no servix dins de l'app instal·lada: cal tornar a entrar després d'«Afegeix a l'inici». A Android, l'app instal·lada compartix les cookies de Chrome i conserva la sessió.
4. **Avisos duplicats:** l'app vella no es desinstal·la sola; si el membre no l'esborra, seguix rebent cada notificació (i tocar-la obri l'app vella, que només mostra la pantalla de canvi).
5. **L'app vella només veu la pantalla després d'actualitzar-se.** La primera obertura després del desplegament servix la versió de la cau (sense `HostMovedComponent`); el service worker baixa la nova i la pantalla ix a la segona obertura (o en tocar «Actualitza»). Cal comptar-ho en la comunicació.
6. **Fase 2 (redirecció 301) trenca l'avís si redirigix també `/app-host.txt`:** el `fetch` same-origin seguiria la redirecció a un altre origen sense CORS i fallaria en silenci → l'app vella deixaria de mostrar la pantalla. `/app-host.txt` ha de seguir responent al host vell.
7. **No hi ha manera de saber qui encara usa el host vell:** Caddy no té `log` d'accés al bloc de la PWA. Sense dades, el tancament és a cegues.

Fora d'abast: el Dashboard (no canvia de host) i el correu de «Heu oblidat la contrasenya?» (apunta a `SITE_ADDRESS`, el Dashboard).

---

## Fluxos dels membres

### A. Té l'app vella instal·lada

1. Obri l'app vella. Primera obertura: res nou (o l'avís «Hi ha una versió nova» → «Actualitza»). Segona obertura: pantalla «L'app ha canviat d'adreça». Des d'este moment l'app vella també es dona de baixa de les notificacions (Tasca 3).
2. Toca «Obre la nova app». Si s'obri dins de l'app (navegador intern), seguix l'ajuda de la pantalla (Tasca 2):
   - **iPhone:** toca la icona de Safari / «Obre a Safari» (o «Copia l'adreça» i l'apega a Safari).
   - **Android:** menú ⋮ → «Obre a Chrome» (o «Copia l'adreça» i l'apega a Chrome).
3. Al navegador, al host nou: «Inicia la sessió» amb correu i contrasenya.
4. A Inici ix el bàner «Instal·la l'app»:
   - **Android:** «Instal·la» → confirma. L'app nova ja té la sessió.
   - **iPhone:** «Compartir» → «Afegeix a l'inici». Obri l'app nova des de la pantalla d'inici i **torna a iniciar la sessió** (dades separades de Safari).
5. Dins de l'app nova: «Activa les notificacions» → «Activa».
6. Esborra l'app vella de la pantalla d'inici.

### B. Usava la PWA al navegador (sense instal·lar) amb el host vell

Igual que A des del pas 1, però el botó ja obri el mateix navegador: passa directament al pas 3. Si no vol instal·lar-la, pot ignorar el bàner; que actualitze el marcador.

### C. Té compte però entra per primera vegada (ja amb el host nou)

1. Obri `https://app-beta.muixerangabarcelona.cat` al navegador (Safari a iPhone, Chrome a Android).
2. «Inicia la sessió». Si no recorda la contrasenya: «Heu oblidat la contrasenya?».
3. Passos 4–5 del flux A.

### D. Enllaç d'invitació emés després del canvi

`PWA_PUBLIC_URL` ja fa que l'enllaç apunte al host nou.

1. Obri l'enllaç **al navegador** (si l'obri des de WhatsApp i s'obri dins de WhatsApp, «Obre al navegador»).
2. «Activa el teu compte» → omplir dades → «Activa el compte». Entra a Inici amb la sessió iniciada.
3. Ix el bàner «Instal·la l'app» (Tasca 4; avui no ix). Passos 4–5 del flux A.

### E. Enllaç d'invitació emés abans del canvi (host vell)

1. Obri l'enllaç: pantalla «L'app ha canviat d'adreça».
2. «Obre la nova app» porta a `https://app-beta…/activate?token=…` (Tasca 1; avui perd el token i cal demanar un enllaç nou).
3. Flux D des del pas 2.

Les invitacions vells caduquen en 72 h: a partir de 3 dies després del canvi este cas ja no existix, però Tasca 1 també cobrix qualsevol marcador amb ruta (`/events/…`).

### Tècnics

Res canvia al Dashboard. Ajuden en persona a l'assaig amb els passos A.2–A.6. Des del Dashboard, «Crea enllaç d'invitació» ja genera enllaços al host nou.

---

## Calendari

| Quan | Què |
|---|---|
| Fet | Fase 1 a pre: `PWA_SITE_ADDRESS=<vell>, <nou>`, `PWA_PUBLIC_URL=https://<nou>` |
| D0 | Desplegar Tasques 1–5. Enviar el missatge als membres (Tasca 5) |
| D0 → D0+3 setm. | Recordatori als assajos; tècnics ajuden in situ. Revisar el log del host vell cada setmana (Tasca 5) |
| Tall | Quan passen **7 dies seguits sense cap petició `/api/*` al host vell** (només `/app-host.txt` i estàtics) o, com a màxim, a les **4 setmanes** amb avís previ. Aplicar fase 2 |
| Fase 2 | Host vell: `/app-host.txt` seguix responent, la resta redirigix 301 al host nou (mateixa ruta). Les apps velles seguixen mostrant la pantalla des de la cau |
| Indefinit | Mantindre el DNS i el bloc de redirecció del host vell (cost zero). No esborrar-los mentre puga quedar alguna app vella instal·lada |

---

## Global Constraints

- Textos visibles en valencià segons `.agents/skills/language-rules/` (tractament «vós», imperatiu en botons).
- Components de `@muixer/ui` (`lib-card`, `lib-button`) i tokens; cap color cru.
- `HostMovedComponent` no pot dependre del `HttpClient` ni de l'`AuthService`: es mostra sense sessió i fora del `router-outlet`.
- No es crea cap endpoint nou a l'API.
- Copy de la pantalla i del manual, exacte, a cada tasca.

## Review Focus

- `/app-host.txt` amb salt de línia final o majúscules (ja cobert per `movedHostUrl`): no ha de canviar la ruta conservada.
- Host vell obert sense service worker (navegador privat): `navigator.serviceWorker` pot no existir → la baixa de push no ha de petar (test a Tasca 3).
- Porta-retalls no disponible (`navigator.clipboard` undefined en context no segur o iOS antic): el botó «Copia l'adreça» no ha de petar; l'adreça seguix visible en text (test a Tasca 2).
- Ruta amb `#`/hash: es descarta (l'app no usa hash routing); test a Tasca 1 que comprova que no es duplica la `/`.
- Membre que torna a obrir l'app vella després d'instal·lar la nova: seguix veient la pantalla, sense errors ni peticions a l'API.

---

## File Structure

- Modify `apps/pwa/src/app/shared/components/host-moved/host-moved.component.ts` — `movedHostUrl` conserva ruta i query; botó «Copia l'adreça»; ajuda per a mode `standalone`; `dropPushSubscription()`.
- Modify `apps/pwa/src/app/shared/components/host-moved/host-moved.component.spec.ts`
- Modify `apps/pwa/src/app/app.component.ts` (+ `.spec.ts`) — passa `location`; dona de baixa push quan s'ha mogut.
- Modify `apps/pwa/src/app/shared/services/install-prompt.service.ts` — `isStandalone()` passa a públic.
- Modify `apps/pwa/src/app/core/auth/services/auth.service.ts` (+ `.spec.ts`) — `registerViaInvite` crida `registerLogin()`.
- Modify `apps/dashboard/Caddyfile` — `log` d'accés al bloc de la PWA.
- Modify `docs/DEPLOY_PRE.md`, `docs/manual/19-pwa.md`.

---

### Task 1: Conservar ruta i query en redirigir al host nou

**Files:**
- Modify: `apps/pwa/src/app/shared/components/host-moved/host-moved.component.ts:10-18`
- Modify: `apps/pwa/src/app/app.component.ts` (`checkPublicHost`)
- Test: `apps/pwa/src/app/shared/components/host-moved/host-moved.component.spec.ts`, `apps/pwa/src/app/app.component.spec.ts`

**Interfaces:**
- Produces: `movedHostUrl(publicUrl: unknown, here: Pick<Location, 'host' | 'pathname' | 'search'>): string | null` — torna `origin` de `publicUrl` + `here.pathname` + `here.search`, o `null` en els mateixos casos que ara.

- [ ] **Step 1: Adaptar els tests existents a la signatura nova i afegir:**

```ts
const at = (host: string, pathname = '/', search = '') => ({ host, pathname, search });

it('keeps the path and query (old invite link)', () => {
  expect(movedHostUrl(target, at('app.beta.muixerangabarcelona.cat', '/activate', '?token=abc')))
    .toBe(`${target}/activate?token=abc`);
});

it('does not double the slash when the public URL ends with one', () => {
  expect(movedHostUrl(`${target}/`, at('app.beta.muixerangabarcelona.cat', '/events/1')))
    .toBe(`${target}/events/1`);
});
```
A `app.component.spec.ts`, el test existent espera `'https://app-beta.muixerangabarcelona.cat/'` (ruta de jsdom `/`): ha de seguir passant.

- [ ] **Step 2:** `nx test pwa --testFile=apps/pwa/src/app/shared/components/host-moved/host-moved.component.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar amb `new URL(here.pathname + here.search, url.origin).href`. `AppComponent` passa `inject(DOCUMENT).location`.
- [ ] **Step 4:** `nx test pwa` → PASS.
- [ ] **Step 5:** `git commit -m "fix(pwa): keep path and query when sending members to the new host"`

### Task 2: Ajuda per a l'app instal·lada i botó «Copia l'adreça»

**Files:**
- Modify: `apps/pwa/src/app/shared/components/host-moved/host-moved.component.ts` (template + classe)
- Modify: `apps/pwa/src/app/shared/services/install-prompt.service.ts` (`isStandalone` → públic)
- Test: `host-moved.component.spec.ts`

**Interfaces:**
- Consumes: `InstallPromptService.isIos: boolean`, `InstallPromptService.isStandalone(): boolean` (ara públic).
- Produces: `HostMovedComponent.copy(): Promise<void>`; signal `copied` (boolean).

Copy exacte (substituïx la llista actual):

```
<p>Esta adreça ja no s'actualitzarà. Per a continuar, instal·leu l'app des de la nova adreça:</p>
<ol>
  <li>Obriu la nova adreça amb el botó de baix.</li>
  @if (standalone) {
    <li>Si s'obri dins d'esta app, passeu al navegador: {{ isIos ? 'toqueu la icona de Safari o «Obre a Safari»' : 'toqueu ⋮ i després «Obre a Chrome»' }}. També podeu copiar l'adreça i apegar-la al navegador.</li>
  }
  <li>Inicieu la sessió amb el vostre correu i contrasenya. Si veníeu d'un enllaç d'invitació, acabeu d'activar el compte.</li>
  <li>Instal·leu l'app: a Android, amb l'avís «Instal·la»; a iPhone, amb «Compartir» i després «Afegeix a l'inici». A iPhone, cal tornar a iniciar la sessió dins de l'app nova.</li>
  <li>Activeu les notificacions a l'app nova.</li>
  <li>Esborreu esta app antiga de la pantalla d'inici.</li>
</ol>
```
Botons: `lib-button` «Obre la nova app» (com ara) i, davall, `lib-button` variant secundària «Copia l'adreça» → text «S'ha copiat l'adreça» quan `copied()`.

- [ ] **Step 1: Tests**

```ts
it('copies the new address', async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
  // render, click the «Copia l'adreça» button
  expect(writeText).toHaveBeenCalledWith('https://app-beta.muixerangabarcelona.cat/');
  expect(text).toContain("S'ha copiat l'adreça");
});

it('does not throw without a clipboard', async () => { /* clipboard undefined → click → no error, copied() false */ });

it('explains how to leave the in-app browser when installed', () => {
  // InstallPromptService stub { isIos: true, isStandalone: () => true }
  expect(text).toContain('«Obre a Safari»');
});

it('hides the in-app browser step in a normal tab', () => {
  // isStandalone: () => false
  expect(text).not.toContain('Obre a');
});
```
- [ ] **Step 2:** `nx test pwa --testFile=…/host-moved.component.spec.ts` → FAIL.
- [ ] **Step 3:** Implementar. `copy()` fa `await navigator.clipboard?.writeText(this.url())` dins de `try` i posa `copied` a `true` només si no falla.
- [ ] **Step 4:** `nx test pwa` → PASS; `nx lint pwa`.
- [ ] **Step 5:** `git commit -m "feat(pwa): guide installed apps out of the in-app browser on host move"`

### Task 3: L'app vella es dona de baixa de les notificacions

**Files:**
- Modify: `host-moved.component.ts` (funció exportada), `app.component.ts` (`checkPublicHost`)
- Test: `app.component.spec.ts`

**Interfaces:**
- Produces: `dropPushSubscription(): Promise<void>` — `navigator.serviceWorker?.ready` → `pushManager.getSubscription()` → `unsubscribe()`; qualsevol error s'ignora. **No** usa `PushSubscriptionService.unsubscribe()` (fa un `DELETE` autenticat sense sessió → 401 → intent de refresc). El servidor desactiva la subscripció en el pròxim enviament (410/404, `web-push.provider.ts:32`).

- [ ] **Step 1: Tests a `app.component.spec.ts`**

```ts
it('unsubscribes this origin from push when the host moved', async () => {
  const unsubscribe = vi.fn().mockResolvedValue(true);
  stubServiceWorker({ getSubscription: async () => ({ unsubscribe }) });
  stubAppHost('https://app-beta.muixerangabarcelona.cat');
  // create, whenStable
  expect(unsubscribe).toHaveBeenCalled();
});

it('keeps push when the host did not move', async () => { /* stubAppHost('') → unsubscribe not called */ });

it('survives a browser without service worker', async () => { /* navigator.serviceWorker undefined + moved → screen shown, no throw */ });
```
- [ ] **Step 2:** `nx test pwa --testFile=apps/pwa/src/app/app.component.spec.ts` → FAIL.
- [ ] **Step 3:** A `checkPublicHost`, quan `movedHostUrl` torna no nul, `void dropPushSubscription()`.
- [ ] **Step 4:** `nx test pwa` → PASS.
- [ ] **Step 5:** `git commit -m "feat(pwa): stop push on the old host once the app has moved"`

### Task 4: Activar el compte per invitació compta com a inici de sessió

**Files:**
- Modify: `apps/pwa/src/app/core/auth/services/auth.service.ts:191-201`
- Test: `apps/pwa/src/app/core/auth/services/auth.service.spec.ts`

**Interfaces:**
- Consumes: `InstallPromptService.registerLogin(): void` (ja injectat a `AuthService`).

- [ ] **Step 1: Test** — `registerViaInvite(payload)` amb resposta 200 → `installPrompt.registerLogin` cridat una vegada (mateix patró que el test de `login`).
- [ ] **Step 2:** `nx test pwa --testFile=apps/pwa/src/app/core/auth/services/auth.service.spec.ts` → FAIL.
- [ ] **Step 3:** Afegir `this.installPrompt.registerLogin();` al `tap` de `registerViaInvite`.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** `git commit -m "fix(pwa): show the install banner right after activating an account"`

### Task 5: Mesurar l'ús del host vell, fase 2 i documentació

**Files:**
- Modify: `apps/dashboard/Caddyfile` (bloc `{$PWA_SITE_ADDRESS}`)
- Modify: `docs/DEPLOY_PRE.md` («Canvi de host de la PWA»)
- Modify: `docs/manual/19-pwa.md` (paràgraf del canvi d'adreça, línia 29)

- [ ] **Step 1: Caddy** — afegir `log` al bloc de la PWA (eixida JSON a stdout per defecte; `request.host` diferencia els hosts).
- [ ] **Step 2: Verificar en local** — `docker compose -f docker-compose.pre.yml config` i `caddy validate --config apps/dashboard/Caddyfile` (amb les variables posades) → sense errors.
- [ ] **Step 3: DEPLOY_PRE.md** — afegir:
  - Consulta de seguiment: `docker compose -f docker-compose.pre.yml logs --since 168h dashboard | grep '"host":"<host vell>"' | grep '"uri":"/api/' | wc -l` (0 durant 7 dies = criteri de tall).
  - Fase 2, bloc exacte (substituïx el `redir` actual del document, que redirigia també `/app-host.txt`):
    ```
    <host vell> {
        handle /app-host.txt {
            header Content-Type "text/plain; charset=utf-8"
            header Cache-Control "no-store"
            respond "{$PWA_PUBLIC_URL}"
        }
        handle {
            redir https://<host nou>{uri} permanent
        }
    }
    ```
    i treure el host vell de `PWA_SITE_ADDRESS`. Explicar per què `/app-host.txt` no es redirigix (forat 6) i que les apps velles seguixen arrancant des de la cau del service worker.
  - El calendari i el criteri de tall d'este pla.
- [ ] **Step 4: Manual 19-pwa.md** — substituir el paràgraf de la línia 29 per una subsecció «Canvi d'adreça de l'app» amb els fluxos A, C i D resumits en passos (mateix copy de botons que Tasca 2), la nota d'iPhone (cal tornar a iniciar la sessió dins de l'app nova) i que cal activar de nou les notificacions. Regenerar captures afectades amb `pnpm run docs:manual-shots` si n'hi ha de la pantalla de canvi.
- [ ] **Step 5: Missatge per als membres** (afegir-lo a DEPLOY_PRE.md perquè els tècnics el copien):
  ```
  📲 L'app de la colla ha canviat d'adreça: https://app-beta.muixerangabarcelona.cat
  1. Obriu l'adreça al navegador (Safari a iPhone, Chrome a Android).
  2. Inicieu la sessió amb el vostre correu i contrasenya.
  3. Instal·leu l'app: a Android, «Instal·la»; a iPhone, «Compartir» → «Afegeix a l'inici» (i torneu a iniciar la sessió dins de l'app).
  4. Activeu les notificacions.
  5. Esborreu l'app antiga.
  L'app antiga deixarà de funcionar el <data de tall>.
  ```
- [ ] **Step 6:** `pnpm run ci:local` → verd.
- [ ] **Step 7:** `git commit -m "docs(deploy): measure old PWA host usage and document the cut-over"`

---

## Verificació manual a pre (després de desplegar)

- [ ] `curl https://<vell>/app-host.txt` i `curl https://<nou>/app-host.txt` → URL nova.
- [ ] Android: app vella instal·lada → obrir dues vegades → pantalla → «Obre la nova app» → «Obre a Chrome» → login → «Instal·la» → app nova amb sessió → activar notificacions → enviar un avís de prova des del Dashboard: arriba **una** vegada.
- [ ] iPhone: el mateix amb Safari; confirmar que dins de l'app nova cal tornar a entrar.
- [ ] Enllaç d'invitació generat abans del desplegament obert al host vell → acaba a `/activate?token=…` del host nou → activació → bàner «Instal·la l'app».
