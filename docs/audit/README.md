# Auditories d'usabilitat i responsive

Auditories automatitzades amb **Playwright** sobre 4 perfils de dispositiu
(`desktop` 1280×800, `tablet-portrait` 768×1024, `tablet-landscape` 1024×768,
`mobile` 393×851), mesurant overflow horitzontal, elements més amples que el
viewport, tap targets < 24px (WCAG), errors de consola i captures full-page.

## Documents

| Àrea | Document | Estat destacat |
|------|----------|----------------|
| Visió general | [AUDIT_UX_RESPONSIVE_2026-07.md](AUDIT_UX_RESPONSIVE_2026-07.md) | Taules sense reflow; base transversal |
| Persons (prioritari) | [AUDIT_PERSONS_2026-07.md](AUDIT_PERSONS_2026-07.md) | 🔴 403 al llistat; botons tallats al detall |
| Events | [AUDIT_EVENTS_2026-07.md](AUDIT_EVENTS_2026-07.md) | 🔴 taula Actuacions 1283px |
| Pinyes | [AUDIT_PINYES_2026-07.md](AUDIT_PINYES_2026-07.md) | 🔴 Distribució/Previsualitza trenquen en mòbil |
| Configuració | [AUDIT_CONFIG_2026-07.md](AUDIT_CONFIG_2026-07.md) | ✅ el més saludable |
| PWA (membres) | [AUDIT_PWA_2026-07.md](AUDIT_PWA_2026-07.md) | ✅ la més polida; 🟠 403 a login |
| Gestos tàctils | [AUDIT_GESTURES_2026-07.md](AUDIT_GESTURES_2026-07.md) | 🔴 sense pinch-zoom ni pan al canvas |
| Comportament PWA | [AUDIT_PWA_BEHAVIOR_2026-07.md](AUDIT_PWA_BEHAVIOR_2026-07.md) | ✅ manifest+SW; ⚠️ offline no confirmat |

> Pendent: una passada amb rol **MEMBER** real, gestos **semàntics** (verificar el resultat de l'assignació, no només que la vista canvia), i confirmació de l'**offline** en desplegament real (Caddy).

## Com reproduir-les

Requereix API (`:3000`) + dashboard (`:4200`) + Postgres (Docker) actius.

```bash
# Tota la visió general (rutes de nivell superior)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:responsive
pnpm audit:report        # obre l'informe HTML de Playwright

# Un mòdul concret del dashboard
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> \
  npx playwright test -c apps/dashboard-e2e/playwright.audit.config.ts \
  apps/dashboard-e2e/src/audit/pinyes-audit.spec.ts

# La PWA (arrenca el servidor de la PWA al :4300)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:pwa

# Gestos tàctils del canvas de Pinyes (perfils tàctils)
E2E_EMAIL=<admin> E2E_PASSWORD=<pass> pnpm audit:gestures

# Comportament PWA: manifest / service worker / offline (build de prod al :4310)
pnpm audit:pwa-behavior
```

Les credencials es passen sempre per variable d'entorn (mai hardcodejades). Els
resultats (JSON de mètriques + captures per dispositiu) es desen a
`apps/dashboard-e2e/audit-results/<mòdul>/` (fora de git).

### Notes tècniques

- **Auth:** l'access token viu en memòria i el refresh token és una cookie
  rotativa d'un sol ús; a més, `/api/auth` està limitat a **10 req/60s**. Per
  això cada test fa **un únic login per dispositiu** i navega **client-side**
  (sense recàrregues). Vegeu `src/audit/login-helper.ts`.
- **IDs de detall:** `src/audit/audit-targets.ts` conté IDs d'exemple de la BD
  de dev (sobreescriptibles per env var); si es reseteja la BD, cal refrescar-los.
- La ruta standalone `/pinyes/.../project` no és assolible de forma fiable per
  navegació SPA; la seva renderització es cobreix via la pestanya *Previsualitza*.
