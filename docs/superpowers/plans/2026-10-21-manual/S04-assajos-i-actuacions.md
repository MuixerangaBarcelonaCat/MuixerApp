# S04 · Assajos i actuacions: pla de secció

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escriure la pàgina del manual que explica les llistes d'assajos i actuacions, com crear-ne i editar-ne, el detall d'un event (Resum, Assistència, Notes, Imprimeix) i la confirmació d'arribada. Ha de deixar clar quines dades venen de l'app antiga i què passa amb els events creats al Dashboard.

**Pàgines:** `docs/manual/07-assajos-i-actuacions.md`

**Rutes cobertes:** `/rehearsals`, `/performances`, `/events/:id`, `/events/:id/confirmation`. Les pestanyes «Pinyes i Figures» i «Participació» de `/events/:id` són de les pàgines 11 i 17. Les pantalles `/rehearsals/sync` i `/performances/sync` són de la pàgina 02.

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `docs/superpowers/plans/2026-10-21-manual/00-general.md` (prerequisit: tasques 1-4 fetes).

---

## Fonts verificades

Tots sota `apps/dashboard/src/app/features/events/`, llevat que s'indique:

| Fitxer | Què se n'ha tret |
|---|---|
| `components/event-list/event-list.component.{html,ts}` | títols «Assajos»/«Actuacions», botons «Assaig nou»/«Actuació nova», «Sincronitza», filtres «Cerca» («Títol, lloc...»), «Temporada» («Totes»), «Quan» («Tots»/«Propers»/«Passats»), columnes (visibles: Data, Títol, Lloc, Hora inici, Assistència, Adults, Pinyes; amagades: Temporada, Estadístiques, Creat), separador «Events passats», accions «Veure detall» i «Gestionar pinyes», format de les columnes Assistència (`✓ ✗ ?` abans, `✓ ! ✗` després) i Pinyes («N segs · N figs»), buit «No s'han trobat assajos amb els filtres actuals» + «Netejar filtres», en crear navega al detall |
| `shared/components/data/column-toggle/column-toggle.component.ts` | «Columnes visibles (N de M)» |
| `shared/components/data/data-table/data-table.component.html` | botó de fila «Accions» (menú), capçalera «Accions» |
| `components/event-form-modal/event-form-modal.component.{html,ts}` | títols «Assaig nou»/«Actuació nova»/«Editar esdeveniment», camps «Títol» (per defecte «Assaig general» en assajos), «Tipus» (bloquejat si es crea des d'una llista), «Data» (pista «Temporada: X» o «Sense temporada»; error «Esta data no és dins de cap temporada.»), «Hora inici», «Lloc», «URL mapa», «Descripció», «Compta per a estadístiques» (marcat per defecte), botons «Cancel·la», «Crea esdeveniment»/«Alça canvis» |
| `components/event-detail/event-detail.component.{html,ts}` | insígnies «Assaig»/«Actuació», «Passat», «Sense estadística», «Assignacions bloquejades»; botons «Sincronitza» (només events sincronitzats, només ADMIN el pot fer servir), «Confirmació» (només assajos), «Imprimeix», «Edita», «Elimina» (confirmació nativa del navegador; error «No es pot eliminar un event que té registres d'assistència.»); targetes de xifres; pestanyes «Resum», «Pinyes i Figures», «Assistència», «Participació»; **la pestanya per defecte és «Pinyes i Figures»**; `?tab=` enllaçable; targetes «Informació» i «Resum assistència» amb «Baixes tardanes», barra «Confirmació»/«Assistència» |
| `components/event-notes-panel/event-notes-panel.component.html` | «Notes» plegable, placeholder «Notes internes per a la tècnica...», «Cancel·la», «Alça» |
| `components/attendance-list/attendance-list.component.{html,ts}` | «Llista d'assistència», filtre d'estat amb comptadors, «Cerca...», columnes «Àlies», «Nom», «Assistència», botons per fase, tornar a fer clic = Pendent, insígnies de només lectura després del dia, «Prov.», icona de xicalla, botó «Notes de X» |
| `components/attendance-edit-modal/attendance-edit-modal.component.html` | «Notes de X», «Notes d'assistència» («Motiu de la no assistència, observacions...»), «Alça» |
| `components/attendance-confirmation/attendance-confirmation.component.{html,ts}` | teclat en pantalla, a partir de 2 lletres, clic a la targeta = «Ha arribat» al moment, «✓ Àlies», «Tanca ✕» (o Esc), «Cap membre coincidix amb «X».», mòbil: «Encara no optimitzat per a mòbil» |
| `libs/shared/src/utils/event-phase.util.ts` | fases abans / el dia / després (calendari d'Europe/Madrid) i les etiquetes d'estat de cada fase |
| `apps/api/src/modules/event/attendance-sweep.service.ts` | a les 3 h del dia d'una **actuació**: «Ve» → «Ha arribat». No toca els assajos |
| `apps/api/src/modules/event/attendance.service.ts`, `apps/api/src/common/utils/lock.util.ts` | canvis d'assistència rebutjats passats 2 dies de l'event («Este event està fora del marge per canviar assistència.») |
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | «Assignacions bloquejades»: 2 dies després de la data (`ASSIGNMENT_LOCK_DAYS`, 2 per defecte) |
| `apps/api/src/modules/sync/strategies/event-sync.strategy.ts` | la sincronització relaciona events per l'identificador de l'app antiga; **sobreescriu** títol, data, hora, lloc, informació i dades d'actuació; no toca «Compta per a estadístiques», descripció, URL del mapa, notes ni segments; importa events fora de temporada |
| `apps/api/src/modules/sync/strategies/attendance-sync.strategy.ts` | la sincronització d'assistència sobreescriu els estats amb els de l'app antiga, **excepte «Ha arribat»/«Assistit»**, que no rebaixa mai; «Baixes tardanes» = «No vaig» a menys de 6 h de l'inici |
| `apps/api/src/modules/sync/sync.controller.ts` | tota la sincronització és `@Roles(ADMIN)` |
| `apps/api/src/modules/me/me.service.ts` | «Compta per a estadístiques» només afecta el percentatge d'assistència del perfil del membre a la PWA |
| `docs/EVENT_SUMMARY_PDF.md` | contingut del PDF d'«Imprimeix» (capçalera, notes, segments) |

### Coses que no quadren (per a avisar qui revise)

- **«Gestionar pinyes» fa exactament el mateix que «Veure detall»** (`navigateToEvent`, sense `?tab=`). Com que el detall s'obri per defecte a «Pinyes i Figures», el resultat és el mateix. El manual ho diu així. Es podria proposar que «Veure detall» obrira «Resum» (`?tab=resum`), en un PR a part.
- Al detall, el botó «Sincronitza» es veu per a tots els tècnics en events que vénen de l'app antiga, però només un ADMIN el pot fer servir: a la resta, està desactivat i no diu per què. El mateix passa amb el «Sincronitza» de les llistes: obri la pantalla de sincronització, però el servidor només ho permet a ADMIN. **Cal confirmar-ho en directe amb un compte TECHNICAL** abans de la demo.
- Contradicció funcional: el servei de les 3 h diu que «la tècnica corregeix els pocs que no han vingut durant el marge de bloqueig». Però al Dashboard la pestanya «Assistència» passa a ser **només lectura l'endemà de l'event**. A partir d'aquell dia, la correcció només es pot fer el mateix dia al Dashboard, o amb «Passa llista» a la PWA («Força el canvi»). El manual ho ha de dir.
- La columna «Nom» de la pestanya «Assistència» i el modal de notes ensenyen nom i primer cognom. La spec diu que al Dashboard només hi ha àlies; no és cert en esta pantalla. Les captures ho tapen.
- La confirmació d'arribada es pot obrir qualsevol dia, i marca «Ha arribat» encara que l'assaig siga d'una altra data.
- No s'ha pogut verificar la data dels events de `TARGETS` («ASSAIG GENERAL», «FESTA MAJOR»). La fase (i per tant els botons d'assistència de la captura) depén del dia en què es facen les captures. Vegeu la Task A.
- No s'ha pogut verificar com responen hui els membres: si encara s'apunten a l'app antiga o ja ho fan a la PWA. El manual diu el que fa el codi: un event creat al Dashboard no existeix a l'app antiga, i l'única manera d'apuntar-s'hi és la PWA (o que la tècnica ho marque). **Cal confirmar-ho amb l'equip.**

---

## Task A: captures

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s04.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s04`)
- Output: `docs/manual/img/07-*.png`

Notes de selectors:
- `lib-button` té `display: contents`: per a ressaltar, apunteu al `button` de dins.
- Les pestanyes del detall tenen `data-testid="event-tab-<id>"` i també es poden obrir directament amb `?tab=resum|assistencia`.
- `lib-modal` és un `<dialog>`; obert = `dialog[open]`, nom accessible = títol.

- [ ] **Step 1: Escriu `s04.ts`**

```ts
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const ASSAIG = `/events/${TARGETS.eventAssaigId}`;
const ACTUACIO = `/events/${TARGETS.eventActuacioId}`;
// Columna «Nom» de la llista d'assistència (nom + primer cognom).
const ATTENDANCE_NAME = 'app-attendance-list tbody td:nth-child(2)';

export const s04: ManualShot[] = [
  {
    file: '07-assajos-llista.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: 'app-data-table tbody tr',
    highlight: 'app-event-list button:has-text("Assaig nou")',
    settle: 600,
  },
  {
    file: '07-llista-accions.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menu').waitFor();
    },
    highlight: '[role="menu"]',
  },
  {
    file: '07-columnes-visibles.png',
    app: 'dashboard',
    path: '/performances',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.locator('app-column-toggle .collapse > input[type="checkbox"]').click();
    },
    clip: 'app-column-toggle',
  },
  {
    file: '07-event-nou.png',
    app: 'dashboard',
    path: '/rehearsals',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Assaig nou' }).click();
      const dialog = page.getByRole('dialog', { name: 'Assaig nou' });
      await dialog.waitFor();
      // Data d'avui perquè es veja la pista «Temporada: …» davall del camp.
      await dialog.locator('input[type="date"]').fill(new Date().toISOString().slice(0, 10));
    },
    highlight: 'dialog[open] lib-checkbox:has-text("Compta per a estadístiques") input',
    clip: 'dialog[open] .modal-box',
  },
  {
    file: '07-detall-resum.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=resum`,
    ready: '#event-tabpanel-resum lib-card',
    highlight: '[data-testid="event-print"] button, button[data-testid="event-print"]',
    settle: 600,
  },
  {
    file: '07-detall-actuacio.png',
    app: 'dashboard',
    path: `${ACTUACIO}?tab=resum`,
    ready: '#event-tabpanel-resum lib-card',
    settle: 600,
  },
  {
    file: '07-notes.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=resum`,
    ready: '[data-testid="event-notes-toggle"]',
    prepare: async (page) => {
      await page.locator('[data-testid="event-notes-toggle"]').click();
      await page.locator('#event-notes-body lib-markdown-editor').waitFor();
    },
    clip: 'app-event-notes-panel',
    settle: 800,
  },
  {
    file: '07-assistencia.png',
    app: 'dashboard',
    path: `${ASSAIG}?tab=assistencia`,
    ready: 'app-attendance-list [data-testid="attendance-status"]',
    highlight: 'app-attendance-list tbody tr:first-child [data-testid="attendance-status"]',
    mask: [ATTENDANCE_NAME],
  },
  {
    file: '07-confirmacio.png',
    app: 'dashboard',
    path: `${ASSAIG}/confirmation`,
    ready: 'app-attendance-confirmation lib-button',
    // Sense escriure res: la llista de la dreta queda buida i no ensenya cap nom.
  },
];
```

Revisa abans d'executar:
- `highlight` de `07-detall-resum.png`: `data-testid="event-print"` és a `<lib-button>`. Comprova si `lib-button` el passa al `button` intern; si no, el contorn ha d'anar a `[data-testid="event-print"] button`. El selector amb coma cobreix tots dos casos.
- `07-event-nou.png`: `lib-checkbox` pot no tindre un `input` amb contorn visible. Si no es veu, ressalta `dialog[open] lib-checkbox`.
- **Fase de `07-assistencia.png`.** Si «ASSAIG GENERAL» és passat, la captura ensenya insígnies de només lectura. Per a ensenyar els botons «Ve»/«No ve», canvia `AUDIT_EVENT_ASSAIG_ID` per un assaig futur de la BD de desenvolupament només per a esta execució. Si no n'hi ha cap, deixa la captura tal com isca i explica les tres fases amb la taula del text. No n'inventes cap.
- No es fa cap captura de «Elimina» (obri un `confirm()` del navegador) ni de «Sincronitza».
- No es fa cap captura de la confirmació d'arribada amb lletres escrites: la llista ensenya nom i cognom.

- [ ] **Step 2: Afig `s04` a `shots/index.ts`**
- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && E2E_EMAIL=… E2E_PASSWORD=… SHOTS=07 pnpm run docs:manual-shots`
Expected: 9 PNG `docs/manual/img/07-*.png`.

- [ ] **Step 4: Revisa cada PNG a mà**
  - cap nom ni cognom visible a la llista d'assistència (columna «Nom» tapada);
  - les notes de l'event (`07-notes.png`) no porten res privat; si en porten, torna a fer la captura d'un altre event amb `AUDIT_EVENT_ASSAIG_ID`;
  - el contorn de «Imprimeix» es veu.
- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s04.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/07-*.png
git commit -m "docs(manual): add screenshots for rehearsals and performances"
```

---

## Task B: `07-assajos-i-actuacions.md`

**Files:** Create `docs/manual/07-assajos-i-actuacions.md`

Primera línia: `<!-- rutes: /rehearsals /performances /events/:id /events/:id/confirmation -->`

### Esquema

**`# Assajos i actuacions`**

**Per a què serveix.** Veure tots els assajos i actuacions, crear-ne de nous i, dins de cada un, veure qui ve, marcar qui ha arribat, apuntar notes i imprimir el resum.

**On és.** Navegació principal → «Assajos» o «Actuacions». Les dues pantalles són iguals; només canvia el tipus d'event.

Captura principal: `![Llista d'assajos](img/07-assajos-llista.png)`

**Secció «D'on vénen els events» (obligatòria; text pla).**
- Hui per hui, la majoria d'assajos i actuacions **vénen de l'app antiga**. Un administrador els porta amb la sincronització (enllaç a `02-dades-app-antiga.md`).
- Un event que ve de l'app antiga es reconeix pel botó «Sincronitza» al seu detall.
- En cada sincronització, l'app antiga **torna a escriure** el títol, la data, l'hora, el lloc i la informació de l'event. Si els canvieu ací, el canvi es perd a la sincronització següent.
- En canvi, la sincronització no toca la descripció, «URL mapa», «Compta per a estadístiques», les «Notes» ni els segments i figures.
- També torna a escriure l'assistència amb el que diu l'app antiga: «Ve», «No ve», «Pendent». L'única excepció és «Ha arribat»: si l'heu marcada ací, es manté.
- Un event creat al Dashboard **no existeix a l'app antiga**: la sincronització no el toca mai. Qui vulga apuntar-s'hi ho ha de fer des de la PWA (o el marqueu vosaltres a «Assistència»).
- Per tant: **si l'event ja és (o serà) a l'app antiga, no el creeu al Dashboard.** Espereu que arribe amb la sincronització. Si el creeu en tots dos llocs, en tindreu dos de repetits.
- Nota per a l'autor: abans de publicar, confirma amb l'equip on s'apunten hui els membres (punt obert de «Coses que no quadren»).

**Pas a pas.**

1. *Trobar un event.*
   - «Cerca» busca per títol i lloc.
   - «Temporada» filtra per temporada.
   - «Quan» té «Tots», «Propers» o «Passats».
   - Els filtres actius apareixen com a etiquetes que es poden llevar; «Netejar filtres» ho buida tot.
   - Els events que ja han passat queden davall de la ratlla «Events passats».
   - Feu clic a la fila per a obrir l'event.
2. *Llegir les columnes.*
   - «Assistència», abans de l'event: ✓ apuntats · ✗ no venen · ? pendents.
   - «Assistència», després de l'event: ✓ han vingut · ! havien dit que venien i no han vingut · ✗ no venen.
   - «Adults» = la mateixa xifra sense la xicalla.
   - «Pinyes» = «N segs · N figs» (segments i figures preparats).
   - «Columnes visibles (N de M)» obri la llista de columnes. Podeu mostrar «Temporada», «Estadístiques» i «Creat». El Dashboard recorda l'elecció en este navegador.
   - Captura: `![Columnes visibles](img/07-columnes-visibles.png)`
3. *Accions d'una fila.* El botó «…» («Accions») té «Veure detall» i «Gestionar pinyes». **Totes dues obrin el mateix**: el detall de l'event, a la pestanya «Pinyes i Figures».
   - Captura: `![Accions de la fila](img/07-llista-accions.png)`
4. *Crear un assaig o una actuació.*
   1. Feu clic a «Assaig nou» o «Actuació nova».
   2. «Tipus» ja ve triat i no es pot canviar.
   3. «Títol»: en assajos ve «Assaig general»; canvieu-lo si cal.
   4. «Data» (obligatòria). Davall apareix «Temporada: …». Si diu «Esta data no és dins de cap temporada.», el botó no funciona: primer cal crear la temporada (enllaç a `05-temporades.md`).
   5. Opcionals: «Hora inici», «Lloc», «URL mapa» (l'enllaç de Google Maps), «Descripció».
   6. «Compta per a estadístiques»: vegeu el punt 5.
   7. Feu clic a «Crea esdeveniment». S'obri el detall del nou event.
   - Captura: `![Assaig nou](img/07-event-nou.png)`
5. *«Compta per a estadístiques».* Ve marcat.
   - Desmarqueu-lo en un assaig cancel·lat o especial que no ha de comptar.
   - Només afecta el percentatge d'assistència que cada membre veu al seu perfil de la PWA.
   - L'event es marca amb la insígnia «Sense estadística».
6. *Editar o esborrar.*
   - Al detall, «Edita» obri el mateix formulari («Editar esdeveniment» → «Alça canvis»). Recordeu el que torna a escriure la sincronització.
   - «Elimina» demana confirmació al navegador. No es pot esborrar un event que ja té assistència («No es pot eliminar un event que té registres d'assistència.»). Per això els events sincronitzats, en general, no es poden esborrar.

**Secció «El detall d'un event».**
- Captura: `![Detall d'un assaig](img/07-detall-resum.png)`
- *Capçalera.* Títol i insígnies:
  - «Assaig» o «Actuació»;
  - «Passat»: ja ha passat l'hora d'inici;
  - «Sense estadística»;
  - «Assignacions bloquejades»: han passat 2 dies de l'event. Ja no es poden canviar figures ni llocs.
- *Botons de la capçalera:*
  - «Sincronitza»: només en events de l'app antiga, i només el pot fer servir un administrador. Porta l'assistència d'este event de l'app antiga. Per a la resta està gris.
  - «Confirmació»: només en assajos. Vegeu més avall.
  - «Imprimeix»: fa un PDF amb la capçalera, les «Notes» i els segments numerats amb les figures i els pisos del tronc. S'obri en una pestanya nova. En mòbils sense visor de PDF es descarrega. Si falla: «No s'ha pogut generar el PDF. Torneu a provar-ho més tard.».
  - «Edita», «Elimina»: vegeu el punt 6 del pas a pas.
- *Xifres.*
  - La primera targeta diu «Ve» abans del dia i «Ha arribat» el dia i després.
  - «Adults» i «Xicalla».
- *Pestanyes.* «Resum», «Pinyes i Figures», «Assistència», «Participació».
  - **En entrar s'obri «Pinyes i Figures».**
  - «Pinyes i Figures» s'explica a `11-segments-i-figures.md`; «Participació», a `17-participacio.md`.
- *Resum.*
  - Targeta «Informació»: data, hores, lloc (amb enllaç si hi ha «URL mapa»), temporada, «Estadística».
  - En actuacions, a més: «A casa», «Autocar», «Colles». Venen de l'app antiga. Captura: `![Detall d'una actuació](img/07-detall-actuacio.png)`.
  - Targeta «Resum assistència»: comptadors per estat, «Adults», «Xicalla», «Total» i una barra «Confirmació» (abans) o «Assistència» (després).
  - «Baixes tardanes»: qui ha dit «No vaig» a menys de 6 hores de l'inici. Només ix a partir del dia de l'event.

**Secció «Notes».**
- El requadre «Notes» que hi ha sobre les pestanyes és per a la tècnica: **els membres no el veuen**.
- Feu clic a «Notes» per a obrir-lo, escriviu (accepta format: títols, llistes, negreta) i feu clic a «Alça». «Cancel·la» desfà el que no heu alçat.
- **Les notes ixen al PDF d'«Imprimeix».** No hi poseu res que no vulgueu imprimir.
- Captura: `![Notes de l'event](img/07-notes.png)`

**Secció «Assistència».**
- Captura: `![Pestanya Assistència](img/07-assistencia.png)`
- Pestanya «Assistència» → «Llista d'assistència». Hi ha un filtre per estat (amb el nombre de persones de cada un) i «Cerca...».
- Els botons de cada fila canvien segons el dia (taula; les etiquetes són literals de `event-phase.util.ts`):

  | Quan | Botons de cada fila | Què vol dir «Pendent» |
  |---|---|---|
  | Abans del dia | «Ve» · «No ve» | encara no ha contestat |
  | El dia de l'event | «Ha arribat» · «No ha arribat» · «No vindrà» | no ha contestat |
  | L'endemà i després | només lectura: «Va vindre» · «No presentat» · «No va vindre» · «Sense resposta» | — |

  - «No ha arribat» = havia dit que venia i encara no ha arribat. «No presentat» = havia dit que venia i no va vindre.
- Un clic posa l'estat. Un altre clic sobre el botó actiu el torna a «Pendent». Es guarda al moment.
- La icona de bafarada de cada fila obri «Notes de X» → «Notes d'assistència» (p. ex. el motiu de la falta) → «Alça».
- Marques de la fila: «Prov.» és una persona provisional (algú que ha vingut per primera vegada); la icona blava és xicalla.
- Feu clic a l'àlies per a obrir la fitxa de la persona.

**Secció «Confirmació d'arribada (assajos)».**
- Captura: `![Confirmació d'arribada](img/07-confirmacio.png)`
- És la pantalla per a la tauleta de l'entrada de l'assaig. Funciona a tota pantalla i té un teclat propi. Al mòbil no s'obri («Encara no optimitzat per a mòbil»).
- Obriu-la amb «Confirmació», al detall de l'assaig.
- Cada membre escriu almenys 2 lletres del seu àlies i toca la seua targeta. Queda marcat com a «Ha arribat» **al moment, sense confirmació**. A dalt apareix «✓ Àlies» uns segons.
- Qui ja ha arribat ja no ix a la llista.
- Per a eixir, «Tanca ✕» o la tecla Esc.
- Si algú toca una targeta que no és la seua, corregiu-ho a la pestanya «Assistència».

**Secció «Actuacions: arribada automàtica».**
- Les actuacions no tenen tauleta. Per això, a les 3 de la matinada del dia de l'actuació, l'app passa tothom que havia dit «Ve» a «Ha arribat».
- El dia de l'actuació, corregiu a «Assistència» qui al final no ha vingut (botó «No ha arribat»).
- Este canvi automàtic no toca mai els assajos ni qui estava «Pendent» o «No ve».

**Si sou de pinyes / Si sou de troncs o xicalla.** No hi ha blocs per perfil: tothom crea events i mira l'assistència igual. Una línia per a tots: la feina de figures comença a la pestanya «Pinyes i Figures» (enllaç a `11-segments-i-figures.md`).

**Compte amb.**
- No creeu al Dashboard un event que ja és a l'app antiga: en tindreu dos.
- Canviar el títol, la data, l'hora o el lloc d'un event de l'app antiga no dura: la sincronització següent ho torna a escriure. Canvieu-ho a l'app antiga.
- Si canvieu «Ve»/«No ve» d'un event de l'app antiga, la sincronització següent ho pot tornar a canviar. «Ha arribat» sí que es manté.
- Sense temporada no es pot crear cap event en eixa data.
- L'endemà de l'event, la llista d'assistència del Dashboard ja no es pot canviar. Si cal una correcció posterior, es fa des de «Passa llista» a la PWA (enllaç a `19-pwa.md`). Passats 2 dies, el servidor ja no accepta canvis sense forçar-los.
- «Assignacions bloquejades» apareix 2 dies després de l'event: ja no es poden tocar les figures.
- «Veure detall» i «Gestionar pinyes» porten al mateix lloc.

**Relacionat.** `02-dades-app-antiga.md` · `05-temporades.md` · `11-segments-i-figures.md` · `17-participacio.md` · `19-pwa.md` («Passa llista», com s'apunten els membres) · `03-persones.md` (fitxa de la persona, persones provisionals).

- [ ] **Step 1:** Escriu la pàgina amb l'esquema de dalt.
- [ ] **Step 2:** Verificació: obri `/config/manual/07-assajos-i-actuacions`. Comprova les 9 imatges i els enllaços interns.
- [ ] **Step 3:** Checklist de llengua del pla arrel. Compte amb «vindre» (no «venir») i «isquen/ix» (no «surten/surt»).
- [ ] **Step 4:** Commit: `git add docs/manual/07-assajos-i-actuacions.md && git commit -m "docs(manual): add rehearsals and performances page"`

---

## Notes per a la demo

**Temps total del bloc: 15 min.** Va just després del bloc «Dades de l'app antiga» (S02): reforça la mateixa idea amb un exemple concret.

1. (2 min) `/rehearsals`: llista, «Quan» → «Propers», la ratlla «Events passats», com es llig la columna «Assistència» abans i després. Obriu «Columnes visibles» i activeu «Temporada».
2. (3 min) **Crear un assaig en directe** (tothom ho ha de saber fer):
   - «Assaig nou»;
   - una data futura de la temporada actual (ensenyeu la pista «Temporada: …»);
   - una data fora de temporada (ensenyeu l'error i el botó desactivat);
   - deixeu «Compta per a estadístiques» marcat i expliqueu quan desmarcar-lo;
   - «Crea esdeveniment».
   Al final, **esborreu-lo** amb «Elimina» perquè no quede brossa (si no té assistència, es pot).
3. (3 min) Missatge sobre l'app antiga, amb un event sincronitzat obert: el botó «Sincronitza» és la marca. Què sobreescriu la sincronització i què no. Regla d'or: si és a l'app antiga, no el creeu ací. Pregunteu en veu alta on s'apunten hui els membres i apunteu la resposta per a `20-preguntes-frequents.md`.
4. (4 min) Detall d'un assaig pròxim:
   - insígnies;
   - «Notes»: escriviu una línia i alceu;
   - «Imprimeix»: ensenyeu el PDF amb la nota que acabeu d'escriure;
   - pestanya «Assistència»: canvieu un estat i torneu-lo a «Pendent» amb un segon clic.
   **Pantalla compartida:** la columna «Nom» ensenya nom i cognom; feu servir un filtre o «Cerca...» amb un àlies conegut.
5. (2 min) «Confirmació» a tota pantalla: escriviu dues lletres i ensenyeu la llista, **sense tocar cap targeta** (marcaria «Ha arribat» de veres). Tanqueu amb Esc.
6. (1 min) Les actuacions s'autocompleten a les 3 h: el mateix dia cal corregir qui no ha vingut.

**Què ha de mirar cada perfil:**
- Tots: crear un event i la regla de l'app antiga.
- Pinyes i troncs: el PDF d'«Imprimeix» (segments, direccions i pisos), que és el full que s'imprimeix per a la plaça.
- Xicalla: el comptador «Xicalla» i la icona de xicalla a la llista d'assistència.

**Preguntes probables:**
- «Per què el meu assaig no ix a l'app antiga?» → els events creats ací no hi van mai.
- «He canviat l'hora i ha tornat a l'hora d'abans» → era un event de l'app antiga; s'ha de canviar allà.
- «No puc canviar l'assistència de l'assaig de dissabte» → a partir de l'endemà és de només lectura al Dashboard; feu-ho des de «Passa llista» a la PWA.
- «No em deixa crear l'assaig» → la data no és dins de cap temporada.
- «Què és "Baixes tardanes"?» → «No vaig» a menys de 6 hores de l'inici.
- «Per què "Gestionar pinyes" i "Veure detall" fan el mateix?» → és així ara mateix; apunteu-ho com a millora.
- «Els membres veuen les Notes?» → no, però ixen al PDF.
