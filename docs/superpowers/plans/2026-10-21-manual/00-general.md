# Manual d'ús del Dashboard: pla d'implementació general

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Muntar el manual d'ús viu (`docs/manual/`), el visor a Configuració → Manual i la suite de captures automàtiques. Després, omplir-lo secció per secció i preparar-ne la demo.

**Architecture:**
- **Contingut:** fitxers Markdown a `docs/manual/`, copiats com a recurs estàtic a `/manual` del Dashboard.
- **Visor:** un component standalone a `features/config/components/manual/` que baixa el `.md` amb `HttpClient` i el renderitza amb `MarkdownService`. Una util pura reescriu les imatges i converteix els enllaços entre pàgines en navegació interna.
- **Captures:** una suite de Playwright dedicada que llig una llista declarativa de captures (un fitxer per secció) i les escriu a `docs/manual/img/`.

**Tech Stack:** Angular 21 (standalone, OnPush, Signals), `@muixer/ui` (`lib-card`, `lib-empty-state`), `@muixer/ui/markdown` (`MarkdownService`), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md`

## Mapa dels plans

Este és el pla arrel. Les tasques 1-4 munten la infraestructura. Cada secció de contingut té el seu pla, en esta mateixa carpeta:

| Pla | Pàgines | Prioritat demo |
|---|---|---|
| `S01-benvinguda-i-primers-passos.md` | 00, 01 | alta |
| `S02-dades-i-persones.md` | 02, 03 | alta |
| `S03-etiquetes-temporades-usuaris.md` | 04, 05, 06 | alta |
| `S04-assajos-i-actuacions.md` | 07 | alta |
| `S05-plantilles.md` | 08, 09, 10 | alta |
| `S06-segments-i-figures.md` | 11 | alta |
| `S07-assignacio-i-conflictes.md` | 12, 13, 14 | alta |
| `S08-distribucio-projeccio-participacio.md` | 15, 16, 17 | alta |
| `S09-comunicacio-i-pwa.md` | 18, 19 | mitjana |
| `S10-demo-i-preguntes-frequents.md` | 20 + guió de la demo | alta (guió) / després de la demo (FAQ) |

Ordre: tasques 1-4 → S01…S09 (independents entre si, es poden fer en paral·lel) → S10.

## Global Constraints

- Textos visibles (manual i UI nova) en valencià, seguint `.agents/skills/language-rules/SKILL.md`: «vós» per a parlar a l'usuari, imperatiu de 2a persona del singular per als botons, cometes «», «alçar» i no «desar» en textos nous. Codi, noms i commits en anglés.
- Noms de botons, pestanyes i camps copiats **literalment** de la UI (plantilla HTML o constant TS), entre «».
- Components `standalone` + `ChangeDetectionStrategy.OnPush` + Signals. Res de `@Input`/`@Output`.
- Només components de `@muixer/ui` i tokens del sistema de disseny. Res de colors hex ni valors arbitraris de Tailwind en codi d'app.
- Sense canvis de backend ni de `MarkdownService`.
- Les pàgines de `docs/manual/` no porten frontmatter. Cada pàgina comença amb `<!-- rutes: ... -->` i segueix la plantilla de l'spec (Per a què serveix · On és · captura · Pas a pas · Si sou de pinyes / Si sou de troncs o xicalla · Compte amb · Relacionat).
- Les captures no poden mostrar dades personals més enllà de l'àlies. El detall de Persona es fa amb `mask`.
- No afegir `Co-Authored-By` als commits (preferència de l'usuari).
- `docs/demo/` i les seues files de `docs/MAP.md`, encara sense commitejar, no es toquen.

## Review Focus

- Slug desconegut a l'URL (`/config/manual/no-existeix`): estat buit «No s'ha trobat la pàgina» amb un enllaç a la benvinguda, no una pantalla en blanc.
- Pàgina llistada a `MANUAL_PAGES` que encara no té fitxer (404 en baixar-la): estat buit «Esta pàgina encara s'està escrivint.», no un spinner infinit.
- Enllaç extern (`https://…`) dins d'una pàgina: continua obrint-se en una pestanya nova, sense passar pel router.
- Enllaç intern amb àncora o prefix (`./04-etiquetes.md#categories`): navega a `/config/manual/04-etiquetes`. L'àncora s'ignora.
- Canvi de pàgina des d'un enllaç dins del contingut: es carrega la pàgina nova i el contenidor torna a dalt.

---

### Task 1: Util d'enllaços i imatges del manual

**Files:**
- Create: `apps/dashboard/src/app/features/config/components/manual/manual-links.util.ts`
- Test: `apps/dashboard/src/app/features/config/components/manual/manual-links.util.spec.ts`

**Interfaces:**
- Produces:
  - `MANUAL_ASSET_BASE = '/manual'`
  - `rewriteManualImages(html: string): string`: canvia `src="img/` (i `src="./img/`) per `src="/manual/img/`.
  - `manualSlugFromHref(href: string | null): string | null`: per a un href relatiu que acaba en `.md` (amb `./` opcional i amb `#àncora` opcional), torna el nom sense extensió. Per a qualsevol altre cas (absolut, `http(s):`, `mailto:`, sense `.md`, `null`), torna `null`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('rewriteManualImages', () => {
  it('prefixes relative img paths', () =>
    expect(rewriteManualImages('<img src="img/03-persones-llista.png" alt="x">'))
      .toBe('<img src="/manual/img/03-persones-llista.png" alt="x">'));
  it('handles ./img', () =>
    expect(rewriteManualImages('<img src="./img/a.png">')).toBe('<img src="/manual/img/a.png">'));
  it('leaves absolute urls alone', () =>
    expect(rewriteManualImages('<img src="https://x/img/a.png">')).toBe('<img src="https://x/img/a.png">'));
});

describe('manualSlugFromHref', () => {
  it.each([
    ['04-etiquetes.md', '04-etiquetes'],
    ['./04-etiquetes.md', '04-etiquetes'],
    ['04-etiquetes.md#categories', '04-etiquetes'],
  ])('%s → %s', (href, slug) => expect(manualSlugFromHref(href)).toBe(slug));
  it.each(['https://example.com/a.md', 'mailto:a@b.c', '/config', null, 'img/a.png'])(
    'returns null for %s', (href) => expect(manualSlugFromHref(href)).toBeNull());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `nx test dashboard --include=**/manual/manual-links.util.spec.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement both functions in `manual-links.util.ts`** (regex, sense dependències)

- [ ] **Step 4: Run tests to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard/src/app/features/config/components/manual/manual-links.util.ts apps/dashboard/src/app/features/config/components/manual/manual-links.util.spec.ts
git commit -m "feat(dashboard): add manual link and image helpers"
```

---

### Task 2: Visor Configuració → Manual

**Files:**
- Create: `apps/dashboard/src/app/features/config/components/manual/manual-pages.ts`
- Create: `apps/dashboard/src/app/features/config/components/manual/manual.component.ts` (+ `.html`)
- Test: `apps/dashboard/src/app/features/config/components/manual/manual.component.spec.ts`
- Modify: `apps/dashboard/src/app/features/config/config.routes.ts` (rutes `manual` i `manual/:slug`, `data: { title: 'Manual' }`)
- Modify: `apps/dashboard/src/app/features/config/config.component.ts` (targeta «Manual», descripció «Com funciona cada pantalla del Dashboard», `routerLink="manual"`, visible per a TECHNICAL i ADMIN, primera de la graella)
- Modify: `apps/dashboard/src/app/shared/constants/domain-icons.ts` (`MANUAL: BookOpen`; `BookOpen` ja està registrada a `app.config.ts`)
- Modify: `apps/dashboard/project.json` (segona entrada d'`assets` a `build.options`: `{ "glob": "**/*", "input": "docs/manual", "output": "manual" }`)
- Create: `docs/manual/00-benvinguda.md` (provisional, amb una sola línia de títol i el comentari de rutes; el contingut real és de S01)

**Interfaces:**
- Consumes: `rewriteManualImages`, `manualSlugFromHref`, `MANUAL_ASSET_BASE` (Task 1)
- Produces:
  - `interface ManualPage { slug: string; title: string; group: string }`
  - `MANUAL_PAGES: readonly ManualPage[]`, en este ordre. Els grups són:
    - «Comencem»: 00 Benvinguda, 01 Primers passos
    - «La base»: 02 Dades de l'app antiga, 03 Persones, 04 Etiquetes, 05 Temporades, 06 Usuaris i accés
    - «Events»: 07 Assajos i actuacions
    - «Plantilles»: 08 Plantilles, 09 Plantilla: pinya i rengles, 10 Plantilla: tronc
    - «Preparar un event»: 11 Segments i figures, 12 Assignació de troncs, 13 Assignació de pinyes, 14 Conflictes, 15 Distribució i nodes extra, 16 Previsualitza i projecció, 17 Participació
    - «Altres»: 18 Comunicació, 19 L'app dels membres (PWA), 20 Preguntes freqüents
    - Cada slug coincideix amb el nom de fitxer de l'spec, sense `.md`.
  - `MANUAL_DEFAULT_SLUG = '00-benvinguda'`
  - Selector `app-manual`.

- [ ] **Step 1: Write the failing component tests** (`HttpTestingController`, `provideRouter` amb la ruta `manual/:slug`)
  - `loads /manual/00-benvinguda.md when no slug` → `httpMock.expectOne('/manual/00-benvinguda.md')`
  - `renders markdown and rewrites images` → respondre `'# Hola\n\n![](img/a.png)'`; el DOM conté `h1` «Hola» i `img[src="/manual/img/a.png"]`
  - `shows "No s'ha trobat la pàgina" for unknown slug` → cap petició HTTP; es mostra el text
  - `shows "Esta pàgina encara s'està escrivint." on 404`
  - `navigates internally on .md link click` → respondre `'[x](04-etiquetes.md)'`; clic a l'`a`; `router.navigate` cridat amb `['/config/manual', '04-etiquetes']`
  - `lets external links through` → `'[x](https://example.com)'`; clic; `router.navigate` no cridat

- [ ] **Step 2: Run tests to verify they fail**

Run: `nx test dashboard --include=**/manual/manual.component.spec.ts`
Expected: FAIL

- [ ] **Step 3: Implement `manual-pages.ts` and `ManualComponent`**
  - El slug ve de `ActivatedRoute.paramMap` (el Dashboard no té `withComponentInputBinding`).
  - La pàgina es baixa amb `HttpClient.get(\`${MANUAL_ASSET_BASE}/${slug}.md\`, { responseType: 'text' })`. Es renderitza amb `MarkdownService.render` + `rewriteManualImages` dins de `<div class="prose prose-sm max-w-none">` (els mateixos estils que `lib-markdown-view`).
  - Un `(click)` al contenidor intercepta els `a`: si `manualSlugFromHref(href)` no és `null`, fa `preventDefault()` i navega.
  - Disposició:
    - menú lateral per grups (`lg` i amunt) amb l'element actiu marcat;
    - per davall de `lg`, un `<select>` natiu amb els mateixos grups (`optgroup`);
    - en canviar de pàgina, `scrollTo(0, 0)` al contenidor.
  - Estats buits amb `lib-empty-state`.
  - Botó «← Configuració» com a la resta de subpàgines.

- [ ] **Step 4: Run tests to verify they pass** (same command). Expected: PASS

- [ ] **Step 5: Comprova-ho en l'app real**

Run: `pnpm run dev:up api dashboard`. Després `E2E_EMAIL=… E2E_PASSWORD=… node .claude/skills/run-muixer-app/driver.mjs dashboard /config /config/manual`
Expected: les captures a `tmp/run-shots/` mostren la targeta «Manual» i la pàgina de benvinguda renderitzada. Comprova també que `nx build dashboard` copia `dist/apps/dashboard/browser/manual/00-benvinguda.md`.

- [ ] **Step 6: Lint and commit**

```bash
nx lint dashboard
git add apps/dashboard/src/app/features/config apps/dashboard/src/app/shared/constants/domain-icons.ts apps/dashboard/project.json docs/manual/00-benvinguda.md
git commit -m "feat(dashboard): add in-app user manual under Configuració"
```

---

### Task 3: Suite de captures del manual

**Files:**
- Create: `apps/dashboard-e2e/playwright.manual.config.ts`
- Create: `apps/dashboard-e2e/src/manual/manual-shot.ts`
- Create: `apps/dashboard-e2e/src/manual/shots/index.ts`
- Create: `apps/dashboard-e2e/src/manual/manual-shots.spec.ts`
- Modify: `apps/dashboard-e2e/src/audit/login-helper.ts` (`loginViaUi(page, creds?)`)
- Modify: `package.json` (script `"docs:manual-shots": "playwright test -c apps/dashboard-e2e/playwright.manual.config.ts"`)
- Modify: `docs/AUDIT_SUITE.md` (una secció breu «Captures del manual»: ordre, variables d'entorn i prerequisit `pnpm run dev:up`)

**Interfaces:**
- Consumes: `loginViaUi`, `spaGoto` (`apps/dashboard-e2e/src/audit/`), `TARGETS` (`audit-targets.ts`)
- Produces (cada pla de secció crea `shots/sNN.ts` i l'afig a `shots/index.ts`):

```ts
export type ManualApp = 'dashboard' | 'pwa' | 'pwa-member';
export interface ManualShot {
  /** Nom del fitxer dins de docs/manual/img/, p. ex. '03-persones-llista.png'. */
  file: string;
  app: ManualApp;
  /** Ruta de l'app; pot usar TARGETS. */
  path: string;
  /** Selector que ha d'existir abans de la captura. */
  ready?: string;
  /** Clics o accions després de navegar (obrir pestanya o modal). */
  prepare?: (page: Page) => Promise<void>;
  /** Selector a ressaltar amb un contorn. */
  highlight?: string;
  /** Selectors que es tapen (dades personals). */
  mask?: string[];
  /** Captura només d'este element en lloc de la finestra. */
  clip?: string;
  settle?: number;
}
export const MANUAL_SHOTS: ManualShot[]; // a shots/index.ts: [...s01, ...s02, …]
```

- [ ] **Step 1: Escriu la configuració.** Hi ha tres projectes:

  | Projecte | `baseURL` | Viewport / dispositiu | Altres |
  |---|---|---|---|
  | `dashboard` | `http://localhost:4200` | 1280×800 | — |
  | `pwa` | `http://localhost:4300` | 390×844, `isMobile`, `hasTouch` | — |
  | `pwa-member` | `http://localhost:4300` | igual que `pwa` | — |

  Opcions comunes:
  - `colorScheme: 'light'`: el tema per defecte és «Sistema», així que n'hi ha prou;
  - `workers: 1`, `screenshot: 'off'`, `timeout: 600_000`;
  - sense `webServer`: l'stack s'alça abans amb `pnpm run dev:up`.

- [ ] **Step 2: Escriu `manual-shots.spec.ts`.** Un test per projecte:
  - Filtra `MANUAL_SHOTS` per `app === project.name` i, si hi ha `SHOTS`, per prefix de fitxer (`SHOTS=03,04`).
  - Fa una sola autenticació per projecte (el límit és de 10 peticions cada 60 s):
    - `pwa-member` usa `E2E_MEMBER_EMAIL`/`E2E_MEMBER_PASSWORD`;
    - si no estan definides, fa `test.skip`.
  - **Mode només lectura:** després d'iniciar la sessió, `page.route('**/api/**')` deixa passar les peticions `GET` i les de `/api/auth/`, i avorta la resta. Així cap captura no pot alçar res a la BD, encara que un clic dispare l'autoguardat de l'editor de plantilles.
  - `ready`, `highlight`, `clip` i `mask` són selectors de `page.locator()` (admeten `:has()` i `text=`).
  - Per a cada captura:
    1. Si `path` és la ruta actual, primer fes `spaGoto('/home')` (el router ignora la navegació a la mateixa URL i l'estat de la captura anterior es quedaria). Després `spaGoto(path)`.
       - Comprova que `page.url()` acaba en `path`. L'espai de treball del segment i la projecció responen al `popstate` tornant enrere, i la navegació pot acabar en una altra pàgina. Si passa, prem `Escape` dues vegades i torna a fer el `spaGoto`.
       - Espera `ready` i, si hi ha `prepare`, l'executa.
    2. Ressalta `highlight` amb `outline: 3px solid red; outline-offset: 2px`. Si l'element té `display: contents` (`lib-card`, `lib-button`, `lib-button-group`), el contorn va al primer fill element, perquè en l'element mateix no es veuria.
    3. Fa `page.screenshot` (o `locator.screenshot` si hi ha `clip`) amb `mask` i `animations: 'disabled'`, i l'escriu a `docs/manual/img/<file>`.
    4. Treu el ressaltat.
  - Si una captura falla, la registra i continua; el test falla al final amb la llista de captures fallides.

- [ ] **Step 3: Crea `shots/index.ts` amb `MANUAL_SHOTS = []` i una captura de prova** (`00-config-manual.png`, `dashboard`, `/config`, `highlight: 'lib-card[title="Manual"]'`). Esta captura la manté S01.

- [ ] **Step 4: Executa-ho**

Run: `pnpm run dev:up && E2E_EMAIL=… E2E_PASSWORD=… pnpm run docs:manual-shots`
Expected: `docs/manual/img/00-config-manual.png` existeix i la targeta «Manual» té el contorn vermell. Els projectes `pwa` i `pwa-member` passen sense captures (o `pwa-member` queda `skipped`).

- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/playwright.manual.config.ts apps/dashboard-e2e/src/manual apps/dashboard-e2e/src/audit/login-helper.ts package.json docs/AUDIT_SUITE.md docs/manual/img/00-config-manual.png
git commit -m "test(e2e): add manual screenshot suite"
```

---

### Task 4: Enllaçar el manual a la documentació

**Files:**
- Modify: `docs/MAP.md`. A la taula «Guies d'ús», afig la fila `| [[00-benvinguda]] | Manual d'ús del Dashboard per als tècnics: una pàgina per pantalla, també a Configuració → Manual (`manual/`) |`.

- [ ] **Step 1: Afig la fila.**
- [ ] **Step 2: Commit només eixa fila.** `docs/MAP.md` ja té tres files sense commitejar de `docs/demo/` que no són d'esta feina. Crea el patch només amb la fila nova (`git diff docs/MAP.md`, edita'l perquè només hi quede la fila nova, `git apply --cached`) i fes el commit:

```bash
git commit -m "docs: link user manual from MAP"
```

Expected: `git diff docs/MAP.md` continua mostrant només les tres files de `docs/demo/`.

---

## Plantilla de pla de secció (S01-S09)

Cada pla de secció té este format. És feina de documentació, no de TDD. La «prova» és la captura generada i la pàgina vista al visor.

1. **Capçalera:** objectiu, pàgines, rutes cobertes, spec i este pla arrel.
2. **Fonts verificades:** fitxers de components i plantilles d'on es copien els textos literals.
3. **Task A: captures.** Crea `apps/dashboard-e2e/src/manual/shots/sNN.ts` amb una entrada `ManualShot` per captura (fitxer, ruta, `ready`, `prepare` amb selectors reals, `highlight`, `mask`) i afig-la a `shots/index.ts`. Executa `SHOTS=<prefixos> pnpm run docs:manual-shots`, revisa els PNG i fes el commit.
4. **Una task per pàgina:**
   - esquema de la pàgina amb els encapçalaments de la plantilla;
   - les tasques del «Pas a pas»;
   - què va als blocs «Si sou de pinyes» / «Si sou de troncs o xicalla»;
   - «Compte amb»;
   - captures referenciades;
   - enllaços «Relacionat».

   Verificació: obrir `/config/manual/<slug>` i passar la checklist de llengua. Després, commit.
5. **Notes per a la demo:** què s'ensenya en directe d'esta secció, amb quines dades, quant de temps i què ha de mirar cada perfil. Les fa servir S10.

Checklist de llengua (cada pàgina):
- [ ] «vós» per a parlar a l'usuari («Obriu», «Feu clic»)
- [ ] noms de botons literals entre «»
- [ ] cap terme tècnic sense explicar
- [ ] formes valencianes (este, hui, alçar)
- [ ] cap gerundi sol, cap «al + infinitiu»
