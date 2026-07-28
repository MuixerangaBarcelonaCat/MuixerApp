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

# Gestos tàctils del canvas de Pinyes (perfils tàctils)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:gestures

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
- La ruta standalone `/pinyes/.../project` no és assolible de forma fiable per navegació SPA: la seua
  renderització es cobreix via la pestanya *Previsualitza*.
- **Mesurar tap targets:** usa sempre `getBoundingClientRect`, no `getComputedStyle`. El `line-height` **no**
  infla la caixa mesurable d'un element `inline` — d'aquí ve el patró `inline-flex items-center min-h-6`
  repartit pel codi.

## Fitxers

| Configuració | Specs |
|--------------|-------|
| `playwright.config.ts` | e2e general (`example.spec.ts`) |
| `playwright.audit.config.ts` | `src/audit/*.spec.ts` (responsive, persons, events, pinyes, config) |
| `playwright.pwa-audit.config.ts` | `src/audit-pwa/pwa-audit.spec.ts` |
| `playwright.gestures.config.ts` | `src/audit-gestures/pinyes-gestures.spec.ts` |
| `playwright.pwa-behavior.config.ts` | `src/audit-pwa-behavior/pwa-behavior.spec.ts` |

Lògica compartida: `src/audit/audit-core.ts` (recollida de mètriques) i `src/audit/login-helper.ts`.
