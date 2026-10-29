# S02 · Dades de l'app antiga i persones: pla de secció

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (o subagent-driven-development) per a executar este pla tasca per tasca. Els passos fan servir caselles (`- [ ]`).

**Objectiu:** escriure dues pàgines.
- La primera explica, sense tecnicismes, per què les dades encara venen de l'app antiga i què es perd o es manté en sincronitzar.
- La segona explica la gestió de persones: llista, filtres, persona nova, fitxa, invitació, adult responsable, delegacions i historial de pinyes.

**Pàgines:**
- `docs/manual/02-dades-app-antiga.md`
- `docs/manual/03-persones.md`

**Rutes cobertes:**
- `02-dades-app-antiga`: `/sync`, `/persons/sync-start`, `/rehearsals/sync`, `/performances/sync`
- `03-persones`: `/persons`, `/persons/:id`

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md`
**Pla arrel:** `docs/superpowers/plans/2026-10-21-manual/00-general.md`

**Prerequisits:** tasques 1-3 del pla arrel fetes. S01 ha creat `shots/s01.ts` (no és bloquejant: `s02.ts` és independent).

---

## Fonts verificades

Camins relatius a `apps/dashboard/src/app/` si no s'indica el contrari.

### Sincronització (pàgina 02)

| Fitxer | Què s'hi ha verificat |
|---|---|
| `features/sync/global-sync.component.ts` | «Sincronització global», «Importa totes les dades des de l'aplicació legacy», avís «Funcionalitat temporal» («…Sincronitza primer les persones, després els events.»), targetes «Sincronitza persones» / «Sincronitza assajos» / «Sincronitza actuacions», nota «Recorda sincronitzar primer les **persones**…» |
| `features/persons/components/person-sync/person-sync.component.html` + `.ts` | «Sincronització de persones», «Preparat per sincronitzar. Premeu el botó per iniciar.», «Sincronitzant... N%», «Sincronització completada ✓», «Nous: · Actualitzats: · Errors:», «Error durant la sincronització», botons «Inicia» / «Torna a sincronitzar» / «Cancel·la» / «Finalitza» (torna a `/persons` i recarrega), «Registre», «Error de connexió amb el servidor», «Sincronització cancel·lada per l'usuari» |
| `features/events/components/event-sync/event-sync.component.html` + `.ts` | «Sincronització d'events», «Preparat per sincronitzar events.»; els mateixos botons. **Totes dues rutes (`/rehearsals/sync` i `/performances/sync`) criden el mateix `GET /sync/events`**, que importa assajos **i** actuacions **i** assistència |
| `features/home/home.component.html` | «Sincronització de dades antigues», «Importa persones, assajos i actuacions des de l'aplicació anterior», «Sincronitza tot» (només navega a `/sync`) |
| `apps/api/src/modules/sync/sync.controller.ts` | **`@Roles(UserRole.ADMIN)` a tot el controlador.** Un compte TECHNICAL veu les pantalles, però la importació falla. El missatge «Ja hi ha una sincronització en curs» apareix si n'hi ha una altra |
| `apps/api/src/modules/sync/strategies/person-sync.strategy.ts` | què es sobreescriu i què no (taula de baix), creació de comptes de membre per correu, responsables de xicalla, àlies duplicats, persones desactivades (BUG-9) |
| `apps/api/src/modules/sync/strategies/event-sync.strategy.ts` | camps d'event que se sobreescriuen. No esborra mai cap event. Crea temporades per defecte si no n'hi ha cap. Avís «N esdeveniments importats no són dins de cap temporada.» |
| `apps/api/src/modules/sync/strategies/attendance-sync.strategy.ts` | regles d'assistència (taula de baix) |
| `features/events/components/event-detail/event-detail.component.html` (l. 35-42) | el botó «Sincronitza» del detall d'event està desactivat per a qui no és ADMIN (ho explica S04) |

**Què fa cada importació.** Ho he llegit al codi. Es pot explicar en paraules planes així:

| Dada | En importar des de l'app antiga | D'on ve |
|---|---|---|
| Nom, cognoms, telèfon, data de naixement | **es reescriu** cada vegada | `updatePerson` |
| Àlies | **es reescriu**. Si un altre ja el té, l'app n'hi posa un de diferent («Àlies Cognom», «Àlies_2»…) i ho anota al «Registre» | `deriveUniqueAlias` |
| «Alçada espatlles» | **es reescriu**. Si a l'app antiga està en blanc, queda en blanc | `shoulderHeight` |
| «Membre», «Acollida», «Data camisa» | **es reescriuen** | `updatePerson` |
| **Etiquetes** | **no es toquen mai** | comentari «NEVER update: positions, isXicalla, notes» |
| «Menor de 16» (xicalla) | només es posa en crear la persona (si la posició de l'app antiga diu CANALLA o NENS COLLA). Després mana el Dashboard | `deriveIsXicalla`, `createPerson` |
| «Observacions tècniques» | només es copien en crear la persona. Després mana el Dashboard | `notes` |
| «Gènere» | no ve mai de l'app antiga | no apareix a l'estratègia |
| Persones provisionals (creades al Dashboard) | no es toquen | no tenen `legacyId` |
| Comptes | per a cada correu nou, l'app crea un compte de membre **sense activar** i el vincula a la persona adulta. Les persones de xicalla amb el mateix correu queden amb eixe compte com a responsable («Pare/Mare») | `upsertUsers`, `assignMainPersons` |
| Persona **desactivada al Dashboard** que encara és a l'app antiga | **es torna a crear com a persona nova i activa**, amb un altre àlies. La desactivada queda com estava | `upsertPerson` (BUG-9) |
| Event: títol, data, hora d'inici, lloc, informació, hora final / «A casa» / «Autocar» / «Colles» | **es reescriuen** | `upsertRehearsalEvent`, `upsertPerformanceEvent` |
| Event: «Descripció», «URL mapa», notes internes, «Compta per a estadístiques», segments i figures | **no es toquen** | no apareixen en l'actualització |
| Events creats al Dashboard | no es toquen, i cap event no s'esborra mai | només es fa *upsert* per `legacyId` |
| Assistència d'un event que ve de l'app antiga | la resposta de l'app antiga **substitueix** la del Dashboard o la PWA per a cada persona que hi apareix. Si a l'app antiga la resposta torna a estar en blanc, aquí torna a «Pendent» | `syncEventAttendance`, `clearAnswers` |
| Assistència marcada com a arribada aquí (passa llista, confirmació) | **no es toca mai** | «An ASSISTIT marked in the app … is ground truth» |
| Notes d'assistència | només es copien si la fila no en tenia | `updateNotesOnCreate` |
| «Potser vinc» en un assaig futur | compta com «Ve» (a l'app antiga és l'única resposta afirmativa abans de l'assaig). En una actuació, «Potser» queda «Pendent» | `mapAttendanceStatus` |

### Persones (pàgina 03)

| Fitxer | Què s'hi ha verificat |
|---|---|
| `features/persons/persons.routes.ts` | `/persons`, `/persons/sync-start`, `/persons/:id` |
| `features/persons/components/person-list.component.html` + `.ts` | «Persones», «Persona nova», «Sincronitza», «Cerca» (placeholder «Àlies, nom...»), «Etiquetes» (selecció múltiple per grups de categoria + opció «Falten etiquetes»), «Estat» → «Sols actius» i el selector «Cens» / «Provisionals», «Neteja filtres», «Filtres actius:», «Columnes visibles (N de M)», columnes (vegeu la Task C), acció «Veure detall», buit «No s'han trobat persones amb els filtres actuals» → «Netejar filtres», tutorial «Doneu accés a la persona» (passos «Persona creada», «Genereu l'enllaç d'invitació», «Per a la xicalla»; botons «Anterior» / «Següent» / «Entesos!») |
| `libs/shared/src/utils/tag-compliance.util.ts` | regla de «Falten etiquetes»: n'hi ha prou amb una etiqueta de Xicalla **o** d'Altres, **o** amb una de Pinya **i** una de Tronc. Tooltip «Falta etiqueta de Pinya i Tronc». Només avisa, mai no bloqueja |
| `apps/api/src/modules/person/person.service.ts` | la cerca no distingeix accents i busca en àlies, nom i cognoms. Si trieu més d'una etiqueta, ix qui en tinga **qualsevol** (no totes). Sense «Sols actius», la llista **inclou** els inactius. Persona provisional: àlies amb prefix «~», error «Ja existeix una persona provisional amb l'àlies "X". Prova amb un altre.». Àlies repetit en editar: «Ja existeix una persona amb l'àlies "X". Contacteu amb l'administrador per canviar-lo.» |
| `features/persons/components/modals/person-new-modal.component.html` | modal «Persona nova», camp «Àlies», «Cancel·la» / «Crea» (desactivat amb l'àlies buit) |
| `features/persons/components/person-detail/person-detail.component.html` + `.ts` | vegeu la Task C. Botons «Edita» / «Cancel·la» / «Alça», «Alçat correctament», targetes «Informació personal» i «Informació de la colla», etiquetes per grup, «Actiu» / «Membre» / «Menor de 16», «Acollida» (En seguiment / Finalitzat / Perdut / No aplica), «Data camisa», «Observacions tècniques» (🤕 Baixa llarga, 🍃 Sense càrrega, ⏰️ Restricció horària, 🐣 Cuida xicalla, «Altre»), secció de compte, «Historial de pinyes», «Metadades» |
| `features/persons/components/person-detail/modals/person-delegate-modal.component.html` + `.ts` | títol «Vincula un delegat» (des de «Defineix adult responsable») o «Afegeix un altre delegat» (des de «+ Afegeix»), «Relació» (Pare/Mare, Tutor/a, Altres; per a xicalla com a responsable, només les dues primeres), «Cerca usuari» («Correu o nom...»), «Cap usuari disponible», «Pendent d'activar», «Afegeix» |
| `apps/api/src/modules/user/user.service.ts` (`createOrRefreshInviteLink`) + `apps/api/src/modules/auth/constants/auth.constants.ts` | l'enllaç d'invitació dura **72 hores** per defecte (`INVITE_TOKEN_TTL_HOURS`). Cada clic en genera un de nou i invalida l'anterior. No s'envia cap correu. Error «Aquesta persona ja té un compte actiu» |
| `apps/api/src/modules/auth/auth.service.ts` (l. 301) | en activar el compte des de l'enllaç, la persona provisional deixa de ser provisional |
| `apps/api/src/modules/person-delegate/person-delegate.service.ts` | errors en vincular: «Esta persona ja gestiona el seu propi compte», «El gestor principal d'un membre de la xicalla ha de ser pare/mare o tutor/a», «El gestor principal ha de ser una persona adulta…». Dos errors encara són en anglés (vegeu «Troballes») |

No s'ha pogut verificar (el Docker estava parat, sense BD):
- Quines persones de la BD local estan en cada estat de compte. La Task A dona les consultes SQL per a triar-les.
- Si l'export de l'app antiga llista també les persones que no han respost. Afecta l'abast de «la resposta de l'app antiga substitueix la del Dashboard». El que sí és segur és que, per a cada persona que hi apareix amb resposta, mana l'app antiga.
- Si la importació s'atura de veritat en fer «Cancel·la». Pel codi, la pantalla deixa d'escoltar i el servidor allibera el bloqueig, però la importació en curs **sembla que continua**. Vegeu «Troballes».

---

## Task A: captures

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s02.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s02` després de `...s01`)

**Regles d'esta secció:**
- **No es fa mai clic a «Inicia», «Crea», «Alça», «Afegeix» ni «Crea enllaç d'invitació».** Les captures només obrin pantalles i modals.
- Dades personals:
  - la llista de persones té la columna «Nom complet» visible per defecte (2a columna), i es tapa;
  - a la fitxa es tapen tots els valors de «Informació personal», el nom complet de la capçalera, les «Observacions tècniques» (poden ser de salut) i els correus de la secció de compte.
- El runner resol els selectors amb `page.locator()`; per això n'hi ha amb `:has-text()`.
- `lib-card`, `lib-button` i `lib-button-group` són `display:contents`. Per això `ready`, `highlight` i `clip` apunten al primer fill (`… > *`). Els `mask` baixen fins a elements reals (`dd`, `input`, `td`).
- Els noms complets també apareixen fora de la fitxa. En esta secció es tapen a la llista (columna «Nom complet») i al modal de delegats (llista d'usuaris). La columna «Nom» d'«Assistència», la targeta de l'assistent d'etiquetatge i la llista d'usuaris són de S03/S04.

- [ ] **Step 1: Tria les persones de la BD local per als estats de compte**

Run: `pnpm run docker:psql` i executa:

```sql
-- Persona adulta amb compte "Pendent d'activar"
SELECT p.id, p.alias FROM persons p JOIN users u ON u.person_id = p.id
WHERE u."isActive" = false AND p."isActive" AND NOT p."isXicalla" LIMIT 5;

-- Xicalla sense compte ni adult responsable ("Crea enllaç d'invitació" desactivat)
SELECT p.id, p.alias FROM persons p
LEFT JOIN users u ON u.person_id = p.id
LEFT JOIN person_delegates d ON d.person_id = p.id AND d."isPrimary"
WHERE p."isXicalla" AND p."isActive" AND u.id IS NULL AND d.id IS NULL LIMIT 5;

-- Xicalla amb adult responsable (enllaç «Responsable»)
SELECT p.id, p.alias FROM persons p JOIN person_delegates d ON d.person_id = p.id AND d."isPrimary"
WHERE p."isXicalla" AND p."isActive" LIMIT 5;
```

Si una consulta no torna res, eixa captura es fa amb `TARGETS.personId` i el text de la pàgina descriu l'estat sense captura. Els noms de columna (`person_id`, `"isPrimary"`, `"isXicalla"`) són els de `1748600000000-InitialSchema.ts`.

- [ ] **Step 2: Crea `shots/s02.ts`** amb els ID trobats com a valor per defecte (sobreescrivibles per entorn, com a `audit-targets.ts`):

```ts
import { Page } from '@playwright/test';
import { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

/** Dev-DB persons in each account state (see S02 plan, Task A step 1). */
const PERSON = {
  detail: TARGETS.personId, // "PERSIANA": must have Historial de pinyes rows
  pendingAccount: process.env['MANUAL_PERSON_PENDING_ID'] || TARGETS.personId,
  xicallaNoGuardian: process.env['MANUAL_PERSON_XICALLA_ID'] || TARGETS.personId,
  xicallaWithGuardian: process.env['MANUAL_PERSON_XICALLA_GUARDIAN_ID'] || TARGETS.personId,
};

/** Waits for the persons table to hold real rows (row links appear only once loaded). */
const LIST_READY = 'app-data-table tbody a[href^="/persons/"]';
/** "Nom complet" is the 2nd default column of the persons table. */
const LIST_MASK = ['app-data-table tbody td:nth-child(2)'];

const INFO_PERSONAL = 'lib-card[title="Informació personal"]';
const INFO_COLLA = 'lib-card[title="Informació de la colla"]';
/** Everything personal on the person detail page in read mode. */
const DETAIL_MASK = [
  'div.flex-1 > p.text-xs',                 // full name under the alias in the header
  `${INFO_PERSONAL} dd`,                    // name, surnames, gender, e-mail, phone, birth date, height
  `${INFO_COLLA} dd.whitespace-pre-wrap`,   // Observacions tècniques (may be health-related)
  `${INFO_COLLA} dl.border-t dd`,           // responsible/delegate e-mails when they have no alias
];
const DETAIL_READY = `${INFO_PERSONAL} dl`;

async function startEditing(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Edita' }).click();
  await page.locator(`${INFO_PERSONAL} input`).first().waitFor();
}

export const s02: ManualShot[] = [
  // ── 02-dades-app-antiga ──────────────────────────────────────────
  {
    file: '02-inici-avis-sincronitzacio.png',
    app: 'dashboard',
    path: '/home',
    ready: 'lib-card[tone="warning"] > *',
    clip: 'lib-card[tone="warning"] > *', // lib-card is display:contents
  },
  {
    file: '02-sincronitzacio-global.png',
    app: 'dashboard',
    path: '/sync',
    ready: 'lib-card[title="Sincronitza persones"] > *',
    highlight: 'lib-card[title="Sincronitza persones"] > *',
  },
  {
    file: '02-sincronitzacio-persones.png',
    app: 'dashboard',
    path: '/persons/sync-start',
    ready: 'button:has-text("Inicia")',
    highlight: 'button:has-text("Inicia")', // DO NOT click: it would really import
  },
  {
    file: '02-sincronitzacio-events.png',
    app: 'dashboard',
    path: '/rehearsals/sync',
    ready: 'button:has-text("Inicia")',
  },

  // ── 03-persones ──────────────────────────────────────────────────
  {
    file: '03-persones-llista.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    mask: LIST_MASK,
    settle: 500,
  },
  {
    file: '03-persones-falten-etiquetes.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.locator('lib-select[label="Etiquetes"] [data-testid="lib-select-multi-trigger"]').click();
      await page.locator('[data-testid="lib-select-multi"] [role="listbox"]').waitFor();
    },
    highlight: '[data-testid="lib-select-multi"] li[role="option"]:has-text("Falten etiquetes")',
    mask: LIST_MASK,
  },
  {
    file: '03-persones-provisionals.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Provisionals' }).click();
      await page.waitForLoadState('networkidle');
    },
    highlight: 'lib-button-group > *', // Cens / Provisionals
    mask: LIST_MASK,
    settle: 500,
  },
  {
    file: '03-persona-nova.png',
    app: 'dashboard',
    path: '/persons',
    ready: LIST_READY,
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Persona nova' }).click();
      await page.locator('dialog[open]').waitFor();
    },
    mask: LIST_MASK, // table stays visible behind the modal backdrop
  },
  {
    file: '03-persona-fitxa.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    mask: DETAIL_MASK,
    settle: 800, // delegates + history load after the person
  },
  {
    file: '03-persona-edicio.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: startEditing, // DO NOT click «Alça»
    highlight: `${INFO_COLLA} [data-tag-group]`,
    mask: [
      'div.flex-1 > p.text-xs',
      `${INFO_PERSONAL} input`,
      `${INFO_PERSONAL} select`,
      `${INFO_COLLA} input[aria-label="Observació"]`,
      `${INFO_COLLA} dl.border-t dd`,
    ],
  },
  {
    file: '03-persona-compte-pendent.png',
    app: 'dashboard',
    path: `/persons/${PERSON.pendingAccount}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Crea enllaç d'invitació")`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-sense-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaNoGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} button:has-text("Defineix adult responsable")`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-xicalla-responsable.png',
    app: 'dashboard',
    path: `/persons/${PERSON.xicallaWithGuardian}`,
    ready: DETAIL_READY,
    highlight: `${INFO_COLLA} dl.border-t`,
    mask: DETAIL_MASK,
    clip: `${INFO_COLLA} > *`,
    settle: 800,
  },
  {
    file: '03-persona-delegat.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    prepare: async (page) => {
      await startEditing(page);
      await page.getByRole('button', { name: '+ Afegeix' }).click();
      await page.locator('dialog[open] [role="listbox"], dialog[open] :text("Cap usuari disponible")').first().waitFor();
    },
    mask: [
      ...DETAIL_MASK,
      `${INFO_PERSONAL} input`,
      `${INFO_PERSONAL} select`,
      'dialog[open] [role="listbox"] button > div:first-child', // alias + e-mail of each user
    ],
    settle: 500, // user list is debounced
  },
  {
    file: '03-persona-historial.png',
    app: 'dashboard',
    path: `/persons/${PERSON.detail}`,
    ready: DETAIL_READY,
    clip: 'div.collapse:has-text("Historial de pinyes")',
    settle: 1000,
  },
];
```

- [ ] **Step 3: Afig `s02` a `shots/index.ts`** (`import { s02 } from './s02';`, `MANUAL_SHOTS = [...s01, ...s02, …]`).

- [ ] **Step 4: Executa-les**

Run: `MANUAL_PERSON_PENDING_ID=… MANUAL_PERSON_XICALLA_ID=… MANUAL_PERSON_XICALLA_GUARDIAN_ID=… E2E_EMAIL=… E2E_PASSWORD=… SHOTS=02,03 pnpm run docs:manual-shots`
Expected: 15 PNG a `docs/manual/img/` (4 de `02-…` i 11 de `03-…`).

- [ ] **Step 5: Revisa els PNG un per un. És la revisió més important de la secció, per les dades personals.**
  - **Llistes:** no hi ha cap nom ni cognom visible. Només àlies, etiquetes i «Actiu».
  - **Fitxes:**
    - no es veu cap nom, cognom, correu, telèfon, data de naixement ni observació;
    - el títol (àlies) i les etiquetes sí que es veuen.
  - **`03-persona-delegat.png`:** la llista d'usuaris del modal està tapada sencera.
  - **`03-persona-historial.png`:** té files. Si està buida («Esta persona no té assignacions registrades.»), tria una altra persona amb historial, defineix-la com a `MANUAL_PERSON_HISTORY_ID` i fes-la servir en eixa entrada.
  - **Captures d'estat de compte:** cadascuna mostra l'estat que diu el nom del fitxer. Si una ha caigut a `TARGETS.personId` i no el mostra, esborra l'entrada i el PNG, i la pàgina ho explica només amb text.
  - **`02-sincronitzacio-persones.png`:** l'estat és «Preparat per sincronitzar. Premeu el botó per iniciar.», sense res al «Registre». Si s'ha llançat una importació per error, cal avisar.

- [ ] **Step 6: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s02.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/02-*.png docs/manual/img/03-*.png
git commit -m "docs(manual): add screenshots for legacy data and persons"
```

---

## Task B: `docs/manual/02-dades-app-antiga.md`

**Files:**
- Create: `docs/manual/02-dades-app-antiga.md`

**To de la pàgina:** sense «API», «legacy», «SSE», «legacyId» ni «sincronització SSE». Es parla de l'«app antiga» (la d'assistència d'abans) i d'«importar». La pantalla diu «legacy» en un subtítol: es pot citar, però cal explicar-lo.

- [ ] **Step 1: Escriu la pàgina amb este esquema**

```markdown
<!-- rutes: /sync /persons/sync-start /rehearsals/sync /performances/sync -->
# Dades de l'app antiga
```

1. **Per a què serveix** (3 frases).
   - Durant una temporada, la colla fa servir dues apps: l'antiga, on la gent encara s'apunta, i MuixerApp, on es preparen les figures.
   - Les persones, els assajos, les actuacions i les respostes d'assistència es copien de l'antiga a MuixerApp. A això en diem importar o sincronitzar.
   - Quan tothom faça servir MuixerApp (l'app del mòbil per a apuntar-se, la passada de llista…), esta pantalla desapareixerà. Per això diu «Funcionalitat temporal».
2. **Per què encara és així** (paràgraf curt, sense tecnicismes):
   - La gent encara s'apunta a l'app antiga, i hi ha dades que només s'hi mantenen allà.
   - Mentre convisquen les dues apps, hi ha dades que «manen» a l'app antiga i dades que «manen» a MuixerApp.
   - Saber quines són de cadascuna evita perdre feina (punt 5).
3. **On és.** Hi ha tres camins:
   - «Inici» → targeta «Sincronització de dades antigues» → «Sincronitza tot». Captura `img/02-inici-avis-sincronitzacio.png`.
   - «Persones» → «Sincronitza».
   - «Assajos» o «Actuacions» → «Sincronitza».

   Tots porten a la mateixa importació. Captura principal `img/02-sincronitzacio-global.png`.
4. **Pas a pas** (només per a comptes d'administració; vegeu «Compte amb»):
   1. **Importeu primer les persones.** Obriu «Sincronitza persones» i feu clic a «Inicia». Captura `img/02-sincronitzacio-persones.png`.
      - Mentre treballa es veu «Sincronitzant... N%» i el «Registre» es va omplint.
      - En acabar es veu «Sincronització completada ✓» i el resum «Nous · Actualitzats · Errors».
      - Feu clic a «Finalitza»: tornareu a «Persones» amb la llista recarregada.
   2. **Després, els events.** Obriu «Sincronitza assajos» o «Sincronitza actuacions». **Fan el mateix**: importen tots els assajos, totes les actuacions i les respostes d'assistència de tots. Captura `img/02-sincronitzacio-events.png`.
      - Cal fer primer les persones perquè, si no, les respostes de les persones noves no troben amb qui lligar-se. Apareixen al «Registre» com a «sense match».
   3. **Llegiu el «Registre».** Mireu sobretot:
      - les línies grogues: avisos com «Alias "X" ja existeix…, assignat "Y"» o «N esdeveniments importats no són dins de cap temporada.» (→ [05](05-temporades.md));
      - les roges: errors.
   4. **Si apareix «Error durant la sincronització»**, feu clic a «Torna a sincronitzar».
      - Si diu «Ja hi ha una sincronització en curs», espereu uns minuts. Una altra persona (o una importació anterior) encara treballa.
   5. **Un sol event.** Per a importar només l'assistència d'un event, hi ha el botó «Sincronitza» del seu detall → [07](07-assajos-i-actuacions.md).
5. **Què canvia i què no en importar** (secció pròpia, el cor de la pàgina). Feu tres llistes a partir de la taula «Què fa cada importació» de les Fonts verificades:
   - **Ho porta l'app antiga: si ho canvieu al Dashboard, la propera importació ho desfà.**
     - nom, cognoms, àlies, telèfon, data de naixement;
     - «Alçada espatlles», «Membre», «Acollida», «Data camisa»;
     - el títol, la data, l'hora i el lloc dels events;
     - les respostes d'assistència (excepte «Ha arribat»).
     - Conclusió: estes coses es canvien a l'app antiga.
   - **Ho porta MuixerApp: la importació no ho toca mai.**
     - etiquetes, «Gènere», delegacions i adults responsables afegits aquí;
     - persones provisionals;
     - events creats aquí;
     - segments, figures i assignacions;
     - notes internes i «Descripció» dels events;
     - «Compta per a estadístiques»;
     - qui ha arribat (passa llista o «Confirmació»).
   - **Ve de l'app antiga només la primera vegada:** «Menor de 16» i «Observacions tècniques». Després es canvien aquí.
   - Afegiu un exemple en dues línies. Si a l'app antiga una persona fa 140 cm d'alçada d'espatlles i ho corregiu a 145 al Dashboard, demà tornarà a dir 140. Corregiu-ho a l'app antiga.
6. **Si sou de pinyes.** Les etiquetes no es perden mai en importar: les podeu treballar tranquil·lament → [04](04-etiquetes.md).
7. **Si sou de troncs o xicalla.**
   - Les alçades d'espatlles vénen de l'app antiga i són les que fa servir el filtre d'alçada de l'assignació de troncs → [12](12-assignacio-troncs.md). Si una alçada és incorrecta, corregiu-la a l'app antiga.
   - «Menor de 16» només es copia la primera vegada, a partir de la posició de l'app antiga. Si un xiquet o xiqueta passa a adult, canvieu-ho al Dashboard.
   - Els xiquets i xiquetes que a l'app antiga comparteixen correu amb un adult queden lligats a eixe adult com a responsable.
8. **Compte amb.**
   - **Només administració.** Només un compte d'administració pot importar. Amb un compte de tècnica, les pantalles s'obrin igual, però en fer «Inicia» apareix «Error de connexió amb el servidor». No és cap avaria: és el permís. Vegeu «Troballes».
   - **Desactivar algú que encara és a l'app antiga.** Si desactiveu al Dashboard una persona que encara és a l'app antiga, la propera importació la torna a crear com a persona nova i activa, amb un àlies diferent. Doneu-la de baixa primer a l'app antiga.
   - **Persones provisionals.** Una persona provisional del Dashboard que després s'apunta a l'app antiga acabarà duplicada. MuixerApp no les lliga soles. Cal avisar qui administra.
   - **Respostes.** Les respostes que la gent dona a l'app del mòbil per a un event que ve de l'app antiga es poden perdre en la importació següent, perquè mana el que diu l'app antiga. Mentre hi haja importacions, la gent s'ha d'apuntar a l'app antiga.
   - **«Potser vinc».** En un assaig futur de l'app antiga, «Potser vinc» compta com «Ve». És l'única resposta afirmativa que hi ha abans de l'assaig.
   - **Esperar.** La importació d'events pot tardar uns minuts. No tanqueu la pestanya mentre diu «Sincronitzant...».
   - **«Cancel·la».** «Cancel·la» només deixa de mostrar el progrés. No està garantit que pare la importació: espereu abans de tornar-la a llançar.
   - **«Sincronitza tot».** El botó d'«Inici» només obri esta pantalla. No importa res per si sol.
9. **Relacionat:** [Persones](03-persones.md), [Temporades](05-temporades.md), [Assajos i actuacions](07-assajos-i-actuacions.md), [Usuaris i accés](06-usuaris-i-acces.md).

- [ ] **Step 2: Verifica-ho al visor.** Obri `/config/manual/02-dades-app-antiga`: les quatre captures es veuen i els enllaços naveguen.
- [ ] **Step 3: Checklist de llengua.**
  - «vós»: «Importeu», «Llegiu», «espereu».
  - Cap terme tècnic sense explicar: «legacy» explicat com a «app antiga»; ni «token» ni «servidor» si es poden evitar.
  - «Registre» i «Sincronitzant...» es copien literalment, encara que el segon siga un gerundi: és el text de la UI.
  - Cap «al + infinitiu».
- [ ] **Step 4: Commit**

```bash
git add docs/manual/02-dades-app-antiga.md
git commit -m "docs(manual): explain legacy data import"
```

---

## Task C: `docs/manual/03-persones.md`

**Files:**
- Create: `docs/manual/03-persones.md`

- [ ] **Step 1: Escriu la pàgina amb este esquema**

```markdown
<!-- rutes: /persons /persons/:id -->
# Persones
```

1. **Per a què serveix.** És la llista de tota la gent de la colla. Des d'ací es busca una persona, es veu i es corregeix la seua fitxa (etiquetes, observacions, estat), i se li dona accés a l'app del mòbil. Les dades personals vénen de l'app antiga ([02](02-dades-app-antiga.md)).
2. **On és.** Pestanya «Persones».
3. Captura principal `img/03-persones-llista.png`.
4. **Pas a pas.**
   1. **Buscar algú.**
      - Escriviu a «Cerca» un àlies, un nom o un cognom. No cal posar accents.
      - Feu clic a la fila per a obrir-ne la fitxa, o feu servir l'acció «Veure detall».
      - Amb Ctrl+clic (Cmd+clic en Mac) s'obri en una pestanya nova i no perdeu els filtres.
   2. **Filtrar.**
      - «Etiquetes» deixa triar-ne una o més, agrupades per categoria. Ix qui en tinga **qualsevol**.
      - «Sols actius» amaga les persones donades de baixa.
      - «Cens» / «Provisionals» canvia entre la gent de l'app antiga i les persones creades ací.
      - Els filtres actius apareixen com a xips sota «Filtres actius:». Cada xip es lleva amb la creu, i tots alhora amb «Neteja filtres».
   3. **Trobar qui no té les etiquetes que toquen.** Captura `img/03-persones-falten-etiquetes.png`.
      - A «Etiquetes», trieu «Falten etiquetes».
      - També es pot fer clic a la insígnia groga «Falten etiquetes» d'una fila: activa el mateix filtre.
      - La regla: cada persona necessita una etiqueta de Xicalla, **o** una d'Altres, **o** una de Pinya **i** una de Tronc alhora.
      - Passeu el ratolí per damunt de la insígnia per a veure què falta, per exemple «Falta etiqueta de Tronc».
      - És només un avís: no impedeix res.
      - Per a etiquetar molta gent de pressa, feu servir l'assistent «Etiqueta persones» → [04](04-etiquetes.md).
   4. **Triar columnes.**
      - «Columnes visibles (N de M)» mostra o amaga columnes. N'hi ha que no es veuen per defecte: «Telèfon», «Data naixement», «Alçada», «Assistències (temp. actual)», «Acollida», «Membre», «Menor de 16», «Data camisa», «Notes», «Creat», «Actualitzat».
      - L'elecció queda guardada en eixe navegador.
      - Feu clic a la capçalera d'una columna per a ordenar-la.
   5. **Crear una persona nova** (algú que encara no és a l'app antiga, per exemple el primer dia que ve). Captura `img/03-persona-nova.png`.
      - Feu clic a «Persona nova», escriviu l'«Àlies» i feu clic a «Crea».
      - La persona queda com a **provisional**:
        - l'àlies porta davant «~»;
        - només ix a la pestanya «Provisionals» (captura `img/03-persones-provisionals.png`).
      - Tot seguit apareix el tutorial «Doneu accés a la persona», amb tres passos: «Persona creada», «Genereu l'enllaç d'invitació» i «Per a la xicalla». En fer «Entesos!» s'obri la fitxa nova.
   6. **Llegir la fitxa.** Captura `img/03-persona-fitxa.png`.
      - Dalt hi ha l'àlies, amb les insígnies «Provisional» i «Inactiu» si cal.
      - «Informació personal»: nom, cognoms, «Àlies», «Gènere», correu, telèfon, «Naixement» i «Alçada espatlles». Al costat de l'alçada es mostra la diferència amb l'alçada de referència.
      - «Informació de la colla»:
        - «Etiquetes»;
        - «Estat» («Actiu» / «Inactiu», «Membre», «Menor de 16»);
        - «Acollida»;
        - «Data camisa» (o «Camisa: No»);
        - «Observacions tècniques».
      - «Historial de pinyes»: vegeu el pas 10.
      - «Metadades» (plegat): «Creat» i «Actualitzat».
   7. **Corregir la fitxa.** Captura `img/03-persona-edicio.png`.
      - Feu clic a «Edita», canvieu el que calga i feu clic a «Alça». Apareix «Alçat correctament». «Cancel·la» desfà els canvis.
      - Les etiquetes es marquen i desmarquen amb un clic, agrupades per categoria.
      - «Observacions tècniques»: trieu una opció ràpida (🤕 Baixa llarga, 🍃 Sense càrrega, ⏰️ Restricció horària, 🐣 Cuida xicalla) o «Altre», per a escriure-hi i triar una icona.
      - Dalt dels camps personals hi ha l'avís de confidencialitat de la colla.
      - **Recordeu quins camps sobreescriu l'app antiga** (vegeu «Compte amb»).
   8. **Donar accés a l'app del mòbil (invitació).** Captura `img/03-persona-compte-pendent.png`.
      - La secció de compte de «Informació de la colla» pot mostrar:
        - «Compte vinculat» + «Compte actiu»: ja té accés, no cal fer res.
        - «Compte vinculat» + «Pendent d'activar»: té un compte creat (per exemple, per l'app antiga) però encara no ha entrat mai.
        - Res de compte: encara no en té cap.
      - En els dos últims casos, feu clic a «Crea enllaç d'invitació». L'enllaç es copia (missatge «Enllaç d'invitació copiat al portapapers.»).
      - Envieu-lo per WhatsApp. **No s'envia cap correu.**
      - La persona l'obri al mòbil i hi tria la contrasenya (→ [19](19-pwa.md)). Si era provisional, deixa de ser-ho.
      - L'enllaç caduca als 3 dies. Si cal, torneu a fer clic: se'n crea un de nou i l'anterior deixa de funcionar.
   9. **Xicalla: l'adult responsable.** Captures `img/03-persona-xicalla-sense-responsable.png` i `img/03-persona-xicalla-responsable.png`.
      - Un xiquet o xiqueta no té compte propi: «Crea enllaç d'invitació» està desactivat. Passeu el ratolí per damunt per a veure'n el motiu.
      - El responsable ha de tindre compte. Si no en té, creeu-lo abans (amb «Persona nova» i una invitació per a l'adult).
      - Des de la fitxa de la xicalla, feu clic a «Defineix adult responsable». S'obri «Vincula un delegat».
      - Trieu la «Relació» («Pare/Mare» o «Tutor/a») i busqueu l'adult a «Cerca usuari». Seleccioneu-lo i feu clic a «Afegeix».
      - Després, la fitxa mostra «Responsable: àlies (Pare/Mare)», amb un enllaç a la fitxa de l'adult.
   10. **Delegacions** (altres persones que poden apuntar esta persona des del seu compte). Captura `img/03-persona-delegat.png`.
       - Amb la fitxa en mode «Edita», a «Delegacions» feu clic a «+ Afegeix». S'obri «Afegeix un altre delegat»: trieu la «Relació» i l'usuari i feu clic a «Afegeix».
       - Per a llevar-ne una, feu clic a «✕» al costat i confirmeu amb «Elimina» a «Eliminar delegat».
   11. **Historial de pinyes.** Captura `img/03-persona-historial.png`.
       - És la llista de tots els llocs on ha estat col·locada la persona: «Data», «Event», «Segment», «Figura» i «Posició».
       - Es pot filtrar per temporada («Totes les temporades»).
       - Feu clic a una fila per a obrir l'event.
5. **Si sou de pinyes.**
   - El vostre filtre és «Falten etiquetes». Una persona amb etiqueta de Pinya però sense cap de Tronc també hi ix. La regla és pinya **i** tronc, si no és xicalla o «Altres».
   - Les etiquetes de pinya decideixen qui es proposa per a cada lloc → [04](04-etiquetes.md), [13](13-assignacio-pinyes.md).
6. **Si sou de troncs o xicalla.**
   - «Alçada espatlles» és la dada que fa servir el filtre d'alçada de l'assignació de troncs → [12](12-assignacio-troncs.md). Ve de l'app antiga: corregiu-la allà.
   - La columna «Alçada» de la llista (amagada per defecte) permet ordenar per alçada.
   - A la fitxa i a la llista, «Menor de 16» vol dir xicalla.
   - El circuit de l'adult responsable és el del pas 9.
7. **Compte amb.**
   - **Camps de l'app antiga.** Nom, cognoms, àlies, telèfon, naixement, «Alçada espatlles», «Membre», «Acollida» i «Data camisa» es reescriuen a la propera importació. Etiquetes, «Gènere», «Menor de 16», «Observacions tècniques» i delegacions no es reescriuen → [02](02-dades-app-antiga.md).
   - **Donar de baixa.** No hi ha cap botó «Elimina». Una persona es dona de baixa amb «Edita», desmarcant «Actiu» i fent «Alça».
     - Si encara és a l'app antiga, la importació la tornarà a crear (vegeu [02](02-dades-app-antiga.md)).
     - Sense «Sols actius», la llista continua mostrant les persones inactives.
   - **Àlies repetit.** Dues persones no poden tindre el mateix àlies: apareix «Ja existeix una persona amb l'àlies…».
     - Per a les provisionals, l'error és «Ja existeix una persona provisional amb l'àlies…». Tingueu en compte que l'àlies de la persona provisional porta «~».
   - **La invitació.**
     - Envieu-la el mateix dia: caduca als 3 dies.
     - Cada clic en fa una de nova i l'anterior deixa de funcionar.
     - Si la persona ja té el compte actiu, apareix «Aquesta persona ja té un compte actiu».
   - **Adult responsable.** «Defineix adult responsable» només ix si la persona no té cap compte ni responsable.
     - L'adult ha de tindre compte (encara que estiga «Pendent d'activar»).
     - Per a xicalla, el responsable ha de ser «Pare/Mare» o «Tutor/a». Si no, apareix «El gestor principal d'un membre de la xicalla ha de ser pare/mare o tutor/a».
   - **Persona provisional i app antiga.** Una persona provisional que després s'apunta a l'app antiga queda duplicada (vegeu [02](02-dades-app-antiga.md)).
   - **Filtres en tornar.** En tornar de la fitxa amb la fletxa «←», la llista torna sense filtres. Per a no perdre'ls, obriu les fitxes en una pestanya nova.
   - **Dades personals.** La llista mostra «Nom complet» per defecte. Si compartiu pantalla, amagueu la columna a «Columnes visibles».
8. **Relacionat:** [Dades de l'app antiga](02-dades-app-antiga.md), [Etiquetes](04-etiquetes.md), [Usuaris i accés](06-usuaris-i-acces.md), [Assignació de troncs](12-assignacio-troncs.md), [Participació](17-participacio.md), [L'app dels membres](19-pwa.md).

- [ ] **Step 2: Verifica-ho al visor.** Obri `/config/manual/03-persones`: les onze captures es veuen.
  - Comprova en l'app real que el text del tutorial «Doneu accés a la persona» no ha canviat (`person-list.component.ts`, `ACTIVATION_TUTORIAL_STEPS`).
- [ ] **Step 3: Checklist de llengua.**
  - «vós».
  - Botons literals: «Persona nova», «Crea», «Edita», «Alça», «Crea enllaç d'invitació», «Defineix adult responsable», «+ Afegeix», «Afegeix», «Elimina».
  - La columna de la llista es diu literalment «Alies», sense accent (vegeu «Troballes»): si es nomena, s'escriu tal com és.
  - Cap «portapapers» sense context. «Xiquet/xiqueta», no «nen».
- [ ] **Step 4: Commit**

```bash
git add docs/manual/03-persones.md
git commit -m "docs(manual): write persons page"
```

---

## Notes per a la demo (les fa servir S10)

**Temps:** 15 minuts.
- 5 min per a la pàgina 02, **sense importar res en directe**, per tres motius: només ho pot fer ADMIN, tarda uns minuts i a pre/producció tocaria dades reals.
- 10 min per a la pàgina 03.

| Minut | Què s'ensenya | Dades |
|---|---|---|
| 0-2 | Per què hi ha dues apps. Obriu «Inici» → «Sincronitza tot» → «Sincronització global» i ensenyeu l'ordre: persones primer, events després. | pantalla en estat «Preparat per sincronitzar» |
| 2-5 | **La taula «què mana on»** de la pàgina 02, oberta al manual. Repetiu l'exemple de l'alçada d'espatlles i el de desactivar algú. | pàgina 02 al visor |
| 5-7 | Llista de persones: «Cerca», «Sols actius», «Cens» / «Provisionals», columnes. **Abans de compartir, amagueu «Nom complet».** | BD de la demo |
| 7-9 | «Falten etiquetes»: activeu el filtre i expliqueu la regla pinya **i** tronc. Enllaç a l'assistent (S03 l'ensenya). | — |
| 9-12 | Fitxa: llegir-la i «Edita». Canvieu una observació tècnica i feu «Alça». Expliqueu quins camps es perden en importar. | **una persona provisional de prova o la de qui presenta**, no una fitxa real amb dades personals |
| 12-15 | Invitació i adult responsable: ensenyeu les captures `03-persona-compte-pendent` i `03-persona-xicalla-sense-responsable`. No genereu cap enllaç real en directe. | captures del manual |

**Què ha de mirar cada perfil:**
- **Pinyes:** «Falten etiquetes» i que les etiquetes no es perden mai en importar.
- **Troncs:** l'alçada d'espatlles, que ve de l'app antiga i s'ha de corregir allà.
- **Xicalla:** «Menor de 16», l'adult responsable i per què la invitació està desactivada per a la xicalla.

**Preguntes probables:**
- «He corregit una alçada i ha tornat a canviar» → mana l'app antiga.
- «He desactivat algú i ara n'hi ha dos» → és la importació. Cal donar-lo de baixa a l'app antiga.
- «Per què no puc importar?» → cal un compte d'administració.
- «La gent pot apuntar-se ja des del mòbil?» → sí, però mentre hi haja importacions, la resposta de l'app antiga mana. Cal decidir-ho com a colla. Apunteu-ho a les preguntes freqüents (S10).
- «Puc crear la persona nova a l'assaig?» → sí: «Persona nova» al Dashboard, o el «+» de «Passa llista» a la PWA ([19](19-pwa.md)).

**Abans de la demo:**
- Prepareu una persona provisional de prova («~Demo») a la BD de la demo. No es pot esborrar, només desactivar.
- Comproveu que el compte de qui presenta és ADMIN, si es vol ensenyar l'error de permís a un compte de tècnica.

---

## Troballes (per a qui coordina els plans)

1. **La importació és només per a ADMIN, però la interfície no ho diu.** `sync.controller.ts` té `@Roles(UserRole.ADMIN)`. En canvi, a la interfície:
   - `/sync`, «Sincronitza» de «Persones» i «Sincronitza» d'«Assajos» / «Actuacions» no comproven el rol;
   - un compte TECHNICAL hi entra, fa «Inicia» i rep «Error de connexió amb el servidor» (la petició torna 403 i `EventSource.onerror` no distingeix el motiu).

   El detall d'event sí que desactiva el seu botó per a no-ADMIN.
2. **«Cancel·la» probablement no atura la importació.** `runLocked` allibera el bloqueig amb `finalize` quan el client tanca la connexió, però `runSync` és una promesa que no es cancel·la. Es podria llançar una segona importació mentre la primera encara escriu.
3. **Desactivar al Dashboard crea un duplicat en la importació següent.** És el comportament deliberat BUG-9 a `person-sync.strategy.ts` (l. 375-383). L'usuari no en té cap avís.
4. **Les persones provisionals no es lliguen mai amb l'app antiga.** La importació només fa coincidir per `legacyId`. Si la persona s'apunta després a l'app antiga, queda duplicada.
5. **`/rehearsals/sync` i `/performances/sync` fan exactament el mateix** (`GET /sync/events`): importen assajos, actuacions i assistència. Les targetes «Sincronitza assajos» / «Sincronitza actuacions» fan pensar que és per separat.
6. **La llista de persones mostra «Nom complet» per defecte.** Contradiu l'spec («Al Dashboard només hi ha àlies, excepte al detall de Persona»). Les captures ho tapen, però l'spec s'hauria de corregir.
7. **Textos inconsistents o fora de la guia d'estil:**
   - columna «Alies» sense accent a la llista (`person-list.component.ts`, l. 59), quan a la resta de llocs és «Àlies»;
   - `global-sync.component.ts`: «Aquesta funcionalitat», «Recorda sincronitzar» (tu), «l'aplicació legacy»;
   - `person-sync` / `event-sync`: «Aquesta opció», «Sincronitzant...» (gerundi sol), «Premeu el botó per iniciar»;
   - error d'API «Ja existeix una persona provisional… **Prova** amb un altre.» (tu);
   - `user.service.ts`: «Aquesta persona ja té un compte actiu»;
   - errors d'API en anglés que l'usuari pot veure al modal de delegats: «A user cannot delegate for their own linked person», «This user is already a delegate for this person». També, al «Registre» de persones: «Sync already in progress», «Fatal error: …»;
   - el botó «Defineix adult responsable» obri un modal titulat «Vincula un delegat»;
   - el missatge d'error en alçar la fitxa diu «Error en desar els canvis» («desar» en lloc d'«alçar»);
   - l'estat buit de la llista diu «Netejar filtres» (infinitiu), i la barra de filtres, «Neteja filtres».
8. **El tutorial «Doneu accés a la persona»** diu «obriu la pestanya "Provisionals" i entreu al perfil». En tancar-lo, però, l'app ja obri la fitxa de la persona nova.
