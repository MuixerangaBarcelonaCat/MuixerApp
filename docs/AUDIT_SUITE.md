---
tags: [qa]
---

# Suite d'auditoria i E2E (Playwright)

Auditories automatitzades sobre 4 perfils de dispositiu (`desktop` 1280×800, `tablet-portrait` 768×1024,
`tablet-landscape` 1024×768, `mobile` 393×851) que mesuren overflow horitzontal, elements més amples que el
viewport, tap targets < 24px (WCAG), errors de consola i captures full-page.

> Els informes d'auditoria de juliol de 2026 i el seu seguiment de correccions s'han esborrat un cop
> aplicades: viuen al git history i a les PR #78–#95. Les troballes que van quedar obertes són a [[DEBT]].

## Com executar-les

Requereix API (`:3000`) + dashboard (`:4200`) + Postgres (Docker) actius.

```bash
# Visió general (rutes de nivell superior, 4 dispositius)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:responsive
pnpm audit:report        # obre l'informe HTML de Playwright

# Un mòdul concret del dashboard
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> \
  npx playwright test -c apps/dashboard-e2e/playwright.audit.config.ts \
  apps/dashboard-e2e/src/audit/pinyes-audit.spec.ts

# PWA (arrenca el servidor de la PWA al :4300)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:pwa

# Gestos tàctils del canvas de Pinyes (pan, pinch, wheel): workspace d'assignació i projecció, els 3
# perfils tàctils (el workspace ja no redirigeix els mòbils: el desktopOnlyGuard només protegeix els editors)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:gestures

# Flux d'assignació tàctil (toc → modal de persones, toc mantingut → moure, intercanviar, cancel·lar,
# sense arrossegar). HERMÈTIC: l'API es simula al navegador; només cal el servidor del dashboard
# (:4200). Sense credencials, sense BD i sense tocar dades de dev.
pnpm e2e:assign-touch

# Comportament PWA: manifest / service worker / offline (build de prod al :4310)
pnpm audit:pwa-behavior
```

Les credencials es passen sempre per variable d'entorn, mai hardcodejades. Els resultats (JSON de mètriques
+ captures per dispositiu) es desen a `apps/dashboard-e2e/audit-results/<mòdul>/`, fora de git.

## Notes tècniques

- **Auth:** l'access token viu en memòria i el refresh token és una cookie rotativa d'un sol ús; a més,
  `/api/auth` està limitat a **10 req/60s**. Per això cada test fa **un únic login per dispositiu** i navega
  **client-side** (sense recàrregues). Vegeu `apps/dashboard-e2e/src/audit/login-helper.ts`.
- **IDs de detall:** `src/audit/audit-targets.ts` conté IDs d'exemple de la BD de dev (sobreescriptibles per
  variable d'entorn); si es reseteja la BD cal refrescar-los.
- La ruta standalone `/pinyes/.../project` no és assolible de forma fiable per navegació SPA (`spaGoto`):
  la majoria d'auditories la cobreixen via la pestanya *Previsualitza*. `canvas-projection-gestures.spec.ts`
  sí que necessita la ruta standalone (és l'única sense `desktopOnlyGuard`, doncs cal provar-la a mòbil), i
  hi arriba amb un `page.goto()` real en lloc de `spaGoto`: la recàrrega perd el JWT en memòria, però el
  hint `muixer_has_session` + la cookie de refresh rotativa disparen un silent-refresh al bootstrap.
- **Mesurar tap targets:** usa sempre `getBoundingClientRect`, no `getComputedStyle`. El `line-height` **no**
  infla la caixa mesurable d'un element `inline` — d'aquí ve el patró `inline-flex items-center min-h-6`
  repartit pel codi.

## Fitxers

| Configuració | Specs |
|--------------|-------|
| `playwright.config.ts` | e2e general (`example.spec.ts`) |
| `playwright.audit.config.ts` | `src/audit/*.spec.ts` (responsive, persons, events, pinyes, config) |
| `playwright.pwa-audit.config.ts` | `src/audit-pwa/pwa-audit.spec.ts` |
| `playwright.gestures.config.ts` | `src/audit-gestures/pinyes-gestures.spec.ts`, `canvas-projection-gestures.spec.ts` |
| `playwright.assign-touch.config.ts` | `src/assign-touch/assign-touch.spec.ts` (+ `mock-api.ts`) |
| `playwright.pwa-behavior.config.ts` | `src/audit-pwa-behavior/pwa-behavior.spec.ts` |

Lògica compartida: `src/audit/audit-core.ts` (recollida de mètriques) i `src/audit/login-helper.ts`.

## Suite tàctil d'assignació (`src/assign-touch`)

A diferència de les auditories de dalt (que van contra l'stack real i mesuren coses observables de
forma grollera), aquesta és **determinista i hermètica**: `mock-api.ts` intercepta tot `/api/**` al
navegador (`page.route`; l'`apiUrl` del dashboard és una URL absoluta cross-origin, així que la petició
mai arriba a l'API real) i serveix una figura fixa amb un petit backend en memòria (assignar,
desassignar i intercanviar canvien el que es retorna després). Per això no cal cap credencial, no toca la
BD de dev i cada test arrenca del mateix estat. Perfils: `phone` (Pixel 5) i `tablet-portrait`.

- **Toc real** amb CDP (`Input.dispatchTouchEvent`, helpers de `audit-gestures/gestures.ts`): passa pel
  mateix pipeline de pointer/touch que un dispositiu, incloent el `contextmenu` natiu que Chrome dispara
  en un toc mantingut (la deduplicació amb el temporitzador es prova de veritat).
- **Pestanya Troncs** (nodes DOM, `data-tronc-node-id`) i **pestanya Pinyes** (canvas Konva): les
  posicions dels nodes es llegeixen de `window.Konva.stages` (Konva s'exposa globalment) en lloc
  d'endevinar píxels; la figura té nodes petits perquè hi càpiguen tots a 100% de zoom en un mòbil.
- **Cobreix:** layout tàctil (2 pestanyes, sense columna lateral, mapa amagat); toc → modal amb la cerca
  enfocada (teclat), cerca que redueix la llista, assignar/canviar/tancar; toc mantingut → bàner «S'està
  movent …», node ressaltat, una sola vibració, sense modal, i el moviment sobreviu a alçar el dit;
  destí buit (mou) / ocupat (intercanvia) / toc mantingut al destí; cancel·lar (fora, ✕, mateix node);
  arrossegar no mou ningú; començar un scroll sobre un node no és un toc mantingut.
- **Comprova que no hi ha peticions sense simular** (`afterEach`), així una crida nova de l'app trenca
  el test en lloc de passar en silenci.
- El sondeig (`unmocked()`) i els `waitForTimeout` són deliberats: els tests negatius («no passa res
  després del retard del toc mantingut») necessiten esperar.

```bash
pnpm e2e:assign-touch                       # els dos perfils
pnpm e2e:assign-touch -- --project=phone    # només mòbil
```
