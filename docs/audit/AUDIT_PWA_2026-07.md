# Auditoria — **PWA** (app de membres)

**Data:** 2026-07-15
**Abast:** `apps/pwa` (port 4300) — app mobile-first orientada a membres: login, inici, agenda d'events, detall d'event (confirmació d'assistència) i perfil.
**Eina:** Playwright (Chromium) — `mobile` 393×851 (principal), `tablet-portrait`, `tablet-landscape`, `desktop`.
**Dades:** BD dev real; login amb ADMIN (accedeix per rol).
**Reproduir:** `pnpm audit:pwa` (spec `audit-pwa/pwa-audit.spec.ts`). Resultats a `apps/dashboard-e2e/audit-results/pwa/`.

---

## 1. Resum executiu

**La PWA és la peça més polida de tot l'ecosistema.** En mòbil ofereix una experiència tipus app nativa: capçalera clara, targetes ben espaiades, **bottom tab bar** (Inici/Agenda/Perfil) i el control de gest **Vinc / No vinc** per confirmar assistència. **Cap overflow horitzontal, cap error de consola** (excepte un 403 a la pantalla de login) a tots els dispositius.

Els únics punts a mirar són menors i esperables en una app mobile-first: en **pantalla ampla el contingut s'estira** a tota l'amplada (sense contenidor centrat), i un parell de detalls de poliment.

---

## 2. Rutes auditades

| Ruta | Estat |
|------|-------|
| `/login` | 🟠 403 (crida sense autenticar) |
| `/home` | ✅ Excel·lent |
| `/events` (agenda) | ✅ OK |
| `/events/:id` (detall) | ✅ OK (1 enllaç petit) |
| `/profile` | ✅ OK |

---

## 3. Troballes 🟠 Mitjana

### PW-M1 — Error **403 Forbidden** a la pantalla de login (sense autenticar)

En carregar `/login` (encara sense sessió) es dispara una crida a l'API que retorna **403**. Es reprodueix a tots els dispositius, i és **el mateix símptoma que al llistat de Persons del dashboard** → probablement una crida comuna (p. ex. bootstrap/`me`/config) llançada abans de tenir sessió o amb permisos insuficients.
- **Recomanació:** evitar la crida quan no hi ha sessió, o degradar-la sense soroll a consola. Investigar de forma conjunta amb `AUDIT_PERSONS_2026-07.md` (PE-H1).

---

## 4. Troballes 🟡 Baixa

- **PW-L1 — Sense contenidor de màxima amplada en pantalla ampla.** En `desktop`/`tablet-landscape` la targeta i la bottom bar s'estiren a tot l'ample (1280px), amb molt espai buit. Com que la PWA és per a telèfon no és crític, però centrar el contingut en una columna (`max-w-md mx-auto`) milloraria l'ús en tablet/escriptori. Captura: `desktop/home.png`.
- **PW-L2 — El botó "No vinc" del toggle trenca en dues línies** ("No" / "vinc") per amplada insuficient del control segmentat, fins i tot quan hi ha espai de sobra. Captura: `mobile/home.png`.
- **PW-L3 — Inputs de login mesurats a 20px d'alçada** (el control real dins d'un wrapper més gran; visualment correcte, però el focus recau en un element petit).
- **PW-L4 — 1 enllaç de ~20px** al detall d'event (`a.link` dins d'un `flex`).

---

## 5. Aspectes positius

- ✅ **Home mòbil impecable:** salutació, "PRÒXIM ASSAIG" com a targeta amb toggle **Vinc/No vinc** (verd = confirmat), hora i lloc, i **bottom tab bar** fixa. Experiència d'app nativa.
- ✅ **Format de data correcte** en minúscules ("Dimecres, 15 de juliol") — millor que el Title-Case del dashboard.
- ✅ **Zero overflow** i **zero errors** de consola en totes les rutes autenticades i dispositius.
- ✅ Navegació per bottom-bar amb icones + etiquetes visibles (millor descobribilitat que la nav només-icones del dashboard en tablet).

---

## 6. Límits de la mesura (pendent)

- **Gestos reals no exercitats:** el tap a *Vinc/No vinc*, swipes, pull-to-refresh i qualsevol interacció tàctil només s'han capturat de forma estàtica. Recomanat: tests amb `page.tap()` / `touchscreen` que verifiquin el canvi d'estat d'assistència.
- **Service worker / offline / instal·labilitat (A2HS):** no s'ha auditat el comportament PWA pròpiament dit (cache, offline, manifest). És una àrea específica a cobrir a part.
- **Rol MEMBER:** s'ha auditat amb un ADMIN; convindria repetir amb un usuari MEMBER real per validar les vistes i permisos que veurà el membre.

---

## 7. Accions proposades

1. 🟠 **PW-M1** — Resoldre el 403 de login (conjuntament amb PE-H1 del dashboard).
2. 🟡 **PW-L1** — Contenidor `max-w-md` centrat per a tablet/desktop.
3. 🟡 **PW-L2** — Amplada del toggle Vinc/No vinc perquè "No vinc" no trenqui.
4. Afegir tests de **gestos** i una passada específica de **comportament PWA** (offline/SW) i amb rol **MEMBER**.
