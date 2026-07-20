# Auditoria — **Comportament PWA** (manifest / service worker / offline)

**Data:** 2026-07-15
**Abast:** capacitats pròpiament PWA de `apps/pwa`: web app manifest, registre del service worker (ngsw) i resiliència offline.
**Eina:** Playwright sobre un **build de PRODUCCIÓ** servit estàticament a `:4310` (`pwa:serve-static`), perquè el service worker d'Angular està **desactivat en `nx serve`** (`enabled: !isDevMode()` a `app.config.ts`).
**Reproduir:** `pnpm audit:pwa-behavior`. Resultat a `apps/dashboard-e2e/audit-results/pwa-behavior/result.json`.

---

## 1. Resum executiu

| Àrea | Estat |
|------|-------|
| **Web App Manifest** | ✅ vàlid i complet |
| **Service Worker (ngsw)** | ✅ es registra i controla la pàgina (en build de prod) |
| **Offline (app shell)** | ⚠️ **no confirmat** — la recàrrega offline no ha renderitzat el shell en el preview estàtic |

El manifest i el service worker estan **correctament configurats i actius** en producció. L'única incògnita és la **resiliència offline**, que no s'ha pogut confirmar en l'entorn de preview (vegeu §4).

---

## 2. Web App Manifest ✅

Valors llegits de `manifest.webmanifest`:

| Camp | Valor |
|------|-------|
| `name` | MuixerApp |
| `short_name` | Muixer |
| `display` | `standalone` |
| `start_url` | `./` |
| `theme_color` | `#6d1a36` |
| `background_color` | `#f2f2f2` |
| icones | 3 (inclou **maskable**) |

Compleix els requisits d'instal·labilitat (nom, display standalone, icones amb variant maskable, colors de tema). ✅

> Suggeriment menor: verificar que hi ha icones de 192px i 512px (les mides que demanen Android/Chrome per a A2HS) entre les 3 declarades.

---

## 3. Service Worker ✅

- `serviceWorker` suportat: **sí**.
- `ngsw-worker.js` accessible: **sí**.
- Registre: **sí** (`registered=true`).
- Controlant la pàgina: **sí** (`controller` present).

El SW s'activa i pren control amb l'estratègia `registerWhenStable:30000`. Correcte en build de producció.

---

## 4. Offline ⚠️ (no confirmat)

Amb el SW actiu, en passar a **offline i recarregar**, el test **no ha detectat el shell renderitzat** (`appShellLoadedOffline=false`), fins i tot després d'un escalfament per deixar que ngsw fes prefetch.

Durant les recàrregues en xarxa s'ha registrat un error **`431 Request Header Fields Too Large`** servit pel servidor estàtic de preview.

**Interpretació (cal cautela):** el 431 apunta a un **artefacte de l'entorn de test**, no necessàriament a un defecte de l'app:
- El preview usa `@nx/web:file-server`, amb un límit de mida de capçaleres baix.
- Les **cookies de `localhost` es comparteixen entre ports** (4200/4300/4310), de manera que les sessions acumulades de les altres auditories poden inflar la capçalera `Cookie` i provocar el 431, cosa que al seu torn pot haver interferit en el prefetch/servei del SW.

**Recomanació:** verificar l'offline **manualment en un desplegament real** (Caddy, domini propi, sense cookies creuades):
1. Carregar la PWA online, esperar el registre del SW.
2. Activar mode avió / offline al navegador.
3. Recarregar → el shell hauria de carregar des de la cache del SW.

Si es vol automatitzar de forma fiable, executar el test PWA-behavior amb un **context net de cookies** i un servidor estàtic amb límit de capçaleres ampli (o el mateix Caddy de `pre`).

---

## 5. Límits de la mesura

- L'offline s'ha provat contra `@nx/web:file-server`, no contra el Caddy de producció/pre.
- No s'ha provat la **instal·lació real (A2HS)** ni el prompt `beforeinstallprompt` (difícil en headless); s'ha validat per criteris de manifest + SW.
- No s'ha auditat l'**estratègia d'actualització** del SW (nova versió disponible → recàrrega), ni el maneig de dades/API offline.

---

## 6. Accions proposades

1. ✅ Manifest i SW: cap acció (correctes).
2. ⚠️ **Confirmar offline** manualment en desplegament real; si falla, revisar `ngsw-config.json` (actualment `assetGroups` prefetch de `index.html`/`*.css`/`*.js` — sembla correcte).
3. 🧪 Endurir el test offline: context net + servidor amb capçaleres amplies, per eliminar el soroll del 431.
4. Afegir cobertura d'**actualització del SW** i comportament de dades offline.
