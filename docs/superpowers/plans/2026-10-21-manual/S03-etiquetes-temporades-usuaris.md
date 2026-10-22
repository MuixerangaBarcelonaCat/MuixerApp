# S03 · Etiquetes, temporades i usuaris: pla de secció

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escriure les pàgines del manual que expliquen les etiquetes (i com influeixen en l'assignació), les temporades i els usuaris, amb les captures generades automàticament.

**Pàgines:** `docs/manual/04-etiquetes.md`, `docs/manual/05-temporades.md`, `docs/manual/06-usuaris-i-acces.md`

**Rutes cobertes:**
- 04: `/config/tags`, `/config/tags/:id`
- 05: `/config/seasons`
- 06: `/config/users`, `/config/legal`

**Spec:** `docs/superpowers/specs/2026-10-21-manual-us-dashboard-design.md` · **Pla arrel:** `docs/superpowers/plans/2026-10-21-manual/00-general.md` (prerequisit: tasques 1-4 fetes, sobretot la Task 3, que crea `ManualShot` i la suite de captures).

---

## Fonts verificades

Textos literals copiats d'estos fitxers (tots sota `apps/dashboard/src/app/`, llevat que s'indique):

| Fitxer | Què se n'ha tret |
|---|---|
| `features/config/config.component.ts` | targetes «Usuaris» («Gestió d'accés i rols»), «Etiquetes» («Categories i etiquetes»), «Temporades» («Gestió de temporades»); només ADMIN: «Privacitat i legal», «Design System» |
| `features/config/config.routes.ts` | `/config/legal` amb `rolesGuard(ADMIN)` |
| `features/config/components/tags-list/tags-list.component.{html,ts}` | «Etiqueta persones», «Etiqueta nova», avís «N persones pendents d'etiquetar», filtre per categoria (només «Totes», «Pinya», «Tronc»), columnes Color/Nom/Categoria/Posicions/Persones/Accions, «Edita», «Elimina», modal «Eliminar etiqueta» |
| `features/config/components/tag-form-modal/tag-form-modal.{html,ts}` | títols «Etiqueta nova»/«Edita etiqueta», camps «Nom», «Categoria» («Seleccioneu una categoria...»), «Color», «Posicions de figura» (grups desplegables per categoria), «Descripció curta», «Descripció llarga», botons «Cancel·la», «Crea»/«Alça» |
| `features/config/components/tagging-wizard-modal/*.{html,ts}` + `tagging-queue.util.ts` | «Etiqueta persones», pestanyes «Pendents»/«Tothom», «Salta a una persona...», «Menor de 16», «Alçada d'espatlles», «Veu el detall», «Anterior»/«Següent», «N de M», buit «No hi ha persones pendents d'etiquetar.» + «Revisa tothom» |
| `features/config/components/tag-detail/tag-detail.component.{html,ts}` | «← Etiquetes», «Edita», «Cerca persona per afegir...», columnes «Àlies»/«Etiquetes», acció de fila «Lleva», modal «Llevar persona» → «Lleva», toasts |
| `features/config/components/season-list/season-list.component.{html,ts}` | «Temporada nova», avís «Hi ha N esdeveniments que no estan dins de cap temporada.», columnes Nom/Data inici/Data fi/Esdeveniments/Accions, insígnia «Actual», enllaços «N assajos · N actuacions», modal «Eliminar temporada» |
| `features/config/components/season-form-modal/season-form-modal.{html,ts}` | «Temporada nova»/«Edita temporada», «Nom», «Data inici», «Data fi», «Descripció», error «La data fi ha de ser posterior a la data d'inici», avís «N esdeveniments quedaran sense temporada. Voleu continuar?», botó «Alça igualment» |
| `features/config/components/user-list.component.{html,ts}` | «Crea usuari», filtres «Cerca» («Correu, nom...»), «Rols», «Estat» → «Sols actius», «Accés» → «Amb accés», columnes, accions de fila «Editar», «Assignar rol» (només ADMIN), «Desactivar»/«Activar», modals «Assignar rol» → «Confirma», «Desactivar usuari»/«Activar usuari» → «Desactiva»/«Activa», noms de rol «Administrador»/«Tècnica»/«Membre» |
| `features/config/components/user-form-modal/user-form-modal.{html,ts}` | «Crea usuari»/«Edita usuari», «Persona vinculada» («Cerca persona per vincular...»), «Correu electrònic», «Contrasenya temporal» («Mínim 8 caràcters»), «Rol *» (TECHNICAL veu només «Tècnica»; ADMIN veu «Tècnica» i «Administrador»), avís «Esta persona ja està vinculada a un altre usuari.» |
| `features/config/components/legal-documents/legal-documents.component.ts` | «Política de Privacitat», «Avís de confidencialitat», «Desa correcció», «Publica versió nova (cal reacceptar)», «Publica», «Veure historial de versions» |
| `features/persons/components/person-detail/person-detail.component.{html,ts}` | «Crea enllaç d'invitació» (desactivat per a «Menor de 16»), «Pendent d'activar», «Compte actiu», toast «Enllaç d'invitació copiat al portapapers.» |
| `features/pinyes/components/person-panel/person-panel.component.{html,ts}` | efecte real de les etiquetes a l'assignació (vegeu «Com condicionen les etiquetes l'assignació», més avall), filtre «Filtra per etiqueta»/«Totes les etiquetes», «Cerca etiqueta...», casella «Xicalla» |
| `features/pinyes/components/segment-workspace/tabs/{pinyes,troncs}-tab/*.html` | totes dues pestanyes passen `activeNodePositionType` al panell |
| `libs/shared/src/utils/tag-category.util.ts` | noms de categoria: «Pinya», «Tronc», «Xicalla», «Altres» |
| `libs/shared/src/constants/node-preset.constants.ts` | noms dels tipus de posició (Segona, Terça… · AGULLA, MANS, VENT… · Direcció tronc/xicalla/pinya · Base) |
| `apps/api/src/modules/user/user.service.ts`, `auth/constants/auth.constants.ts` | l'enllaç d'invitació crea un usuari MEMBER inactiu, caduca a les 72 h (`INVITE_TOKEN_TTL_HOURS`), no s'envia per correu; no podeu canviar-vos el rol ni desactivar-vos; un TECHNICAL no pot tocar un compte ADMIN; desactivar tanca totes les sessions |
| `apps/api/src/modules/tag/tag.service.ts` | «No es pot esborrar: hi ha persones amb aquesta etiqueta assignada.» |
| `apps/api/src/modules/season/season.service.ts`, `docs/DATA_MODEL.md` invariant 12 | temporades sense solapaments, temporada derivada de la data, 409 en deixar events sense temporada |
| `docs/TAGS.md` | model i regla mínima (contrastat amb el codi; vegeu «Coses que no quadren») |

### Com condicionen les etiquetes l'assignació (verificat al codi)

Este és el punt que la spec demana explicar amb precisió. El que fa el codi, i res més:

1. **Ordenen, no trien.** En seleccionar un lloc de la figura (pestanyes Pinyes i Troncs de l'espai de treball del segment), el panell de persones posa **primer** les persones que porten una etiqueta amb aquell tipus de posició a «Posicions de figura» (`sortByPosition`, `person-panel.component.ts`). Ningú no desapareix de la llista: la resta continua davall.
   - S'aplica al grup de confirmats («Ve (N)» abans del dia, «Ha arribat (N)» el dia) i al grup de qui havia dit que venia i no ha arribat.
   - Si a més heu posat una alçada, dins de cada bloc s'ordena per alçada.
2. **Marquen amb un punt de color.** Al costat de l'àlies apareix un punt del color de l'etiqueta que coincideix (amb el nom de l'etiqueta en passar-hi el ratolí). Al grup «No ha arribat», qui no coincideix es veu més apagat.
3. **Filtre manual.** El botó «Totes les etiquetes» del panell (etiqueta accessible «Filtra per etiqueta») obri una llista amb «Cerca etiqueta...». Si en trieu una, el panell **només** mostra persones amb eixa etiqueta (lliures i ja col·locades). Es lleva amb «✕» («Neteja el filtre d'etiqueta»).
4. **No bloquegen mai res.** Qualsevol persona es pot posar a qualsevol lloc, porte l'etiqueta que porte. No hi ha cap assignació automàtica.
5. **La coincidència va pel tipus de posició del lloc**, no pel text que hi ha escrit. Ve de «Tipus de posició» a l'editor de plantilles. Si un lloc no té tipus (o és un comodí «...»), no hi ha ordenació ni punt.
6. **Compte:** la casella «Xicalla» del panell **no** mira l'etiqueta del grup Xicalla. Mira «Menor de 16» de la fitxa de la persona. Ve desmarcada: les persones menors de 16 no es veuen fins que la marqueu.
7. Etiquetes de Xicalla i Altres: el formulari no ofereix «Posicions de figura» per a estes categories. Per tant, mai no ordenen ni pinten el punt. Només serveixen per al filtre manual, per a la regla mínima i per a la columna «Etiquetes».

### Coses que no quadren (per a avisar qui revise)

- `docs/TAGS.md` §4 parla d'un badge «Sense etiquetar» i d'un filtre «No compleix la regla». A la UI actual (`person-list.component.html`) els dos es diuen **«Falten etiquetes»**. El manual fa servir «Falten etiquetes». `docs/TAGS.md` s'hauria de corregir en un altre PR.
- `docs/TAGS.md` §4 diu que la banda «N persones pendents d'etiquetar» obri l'assistent. Al codi és un `span` sense clic: l'assistent s'obri només amb el botó «Etiqueta persones».
- El filtre per categoria de `/config/tags` només té «Totes», «Pinya» i «Tronc» (no hi ha «Xicalla» ni «Altres»).
- Tres captures poden mostrar dades personals si no es tapen: l'assistent «Etiqueta persones» (nom i cognoms a la fitxa, observacions), la llista d'usuaris (columna «Correu» i columna «Persona», que porta nom i cognom) i el modal «Crea usuari» si es tria una persona. Les captures de baix ja tapen les dues primeres; la tercera no tria cap persona.
- No s'ha pogut verificar el rol de l'usuari E2E. La captura «Assignar rol» només funciona amb ADMIN (vegeu Task A).
- Les accions de fila de la taula d'usuaris es diuen «Editar», «Assignar rol», «Desactivar»/«Activar» (infinitiu, no segueixen la regla de l'imperatiu). El manual les copia tal com són. Es pot obrir un PR a part per a canviar-les.

---

## Task A: captures

**Files:**
- Create: `apps/dashboard-e2e/src/manual/shots/s03.ts`
- Modify: `apps/dashboard-e2e/src/manual/shots/index.ts` (afig `...s03`)
- Output: `docs/manual/img/04-*.png`, `05-*.png`, `06-*.png`

Notes de selectors:
- `lib-button`, `lib-badge` i `lib-input` tenen `display: contents`: un contorn al host no es veu. Ressalteu sempre el `button`/`input` de dins.
- `lib-modal` és un `<dialog>` natiu: quan està obert té l'atribut `open` (`dialog[open]`) i el nom accessible és el títol (`getByRole('dialog', { name: '…' })`).
- `highlight`, `mask` i `clip` són selectors de Playwright (accepten `:has-text()` i `:has()`).

- [ ] **Step 1: Escriu `s03.ts`**

```ts
import type { Page } from '@playwright/test';
import type { ManualShot } from '../manual-shot';
import { TARGETS } from '../../audit/audit-targets';

const openTagEdit = async (page: Page, name: string) => {
  await page.getByRole('button', { name: `Edita ${name}` }).click();
  await page.locator('dialog[open]').waitFor();
};

export const s03: ManualShot[] = [
  // ── 04 Etiquetes ─────────────────────────────────────────────
  {
    file: '04-etiquetes-llista.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: 'app-tags-list tbody tr td.font-medium',
    highlight: 'app-tags-list button:has-text("Etiqueta persones")',
  },
  {
    // Formulari d'una etiqueta de pinya amb el grup «Pinya» de «Posicions de figura» desplegat.
    file: '04-etiqueta-posicions.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: 'app-tags-list tbody tr td.font-medium',
    prepare: async (page) => {
      await openTagEdit(page, '1es Mans');
      await page.locator('dialog[open] details summary').first().click();
    },
    highlight: 'dialog[open] .form-control:has-text("Posicions de figura")',
    clip: 'dialog[open] .modal-box',
  },
  {
    // Assistent en mode «Tothom» perquè sempre hi haja una fitxa (en «Pendents» pot estar buit).
    file: '04-assistent-etiquetatge.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: 'app-tags-list tbody tr td.font-medium',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Etiqueta persones' }).click();
      await page.getByRole('dialog', { name: 'Etiqueta persones' }).getByRole('tab', { name: 'Tothom' }).click();
      await page.locator('app-tagging-wizard-modal [data-testid^="tag-group-"]').first().waitFor();
    },
    // Nom i cognoms de la fitxa + observacions: dades personals.
    mask: ['app-tagging-wizard-modal section h3', 'app-tagging-wizard-modal section p.bg-base-100'],
    clip: 'dialog[open] .modal-box',
  },
  {
    file: '04-etiqueta-detall.png',
    app: 'dashboard',
    path: '/config/tags',
    ready: 'app-tags-list tbody tr td.font-medium',
    prepare: async (page) => {
      await page.getByRole('row', { name: /1es Mans/ }).locator('td.font-medium').click();
      await page.locator('app-tag-detail app-data-table').waitFor();
    },
    highlight: 'app-tag-detail app-person-search-input input',
  },
  {
    // Panell de persones de l'espai de treball amb el filtre d'etiqueta obert.
    file: '04-panell-filtre-etiqueta.png',
    app: 'dashboard',
    path: `/pinyes/events/${TARGETS.workspaceEventId}/segments/${TARGETS.workspaceSegmentId}/assign/${TARGETS.workspaceInstanceId}`,
    ready: 'app-person-panel',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Filtra per etiqueta' }).click();
      await page.getByPlaceholder('Cerca etiqueta...').waitFor();
    },
    clip: 'app-person-panel',
    settle: 800,
  },

  // ── 05 Temporades ────────────────────────────────────────────
  {
    file: '05-temporades-llista.png',
    app: 'dashboard',
    path: '/config/seasons',
    ready: 'app-season-list tbody tr td.font-medium',
    highlight: 'app-season-list tbody tr:has-text("Actual")',
  },
  {
    file: '05-temporada-nova.png',
    app: 'dashboard',
    path: '/config/seasons',
    ready: 'app-season-list tbody tr td.font-medium',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Temporada nova' }).click();
      await page.getByRole('dialog', { name: 'Temporada nova' }).waitFor();
    },
    clip: 'dialog[open] .modal-box',
  },

  // ── 06 Usuaris i accés ───────────────────────────────────────
  {
    file: '06-usuaris-llista.png',
    app: 'dashboard',
    path: '/config/users',
    ready: 'app-data-table tbody tr',
    highlight: 'button:has-text("Crea usuari")',
    // Columnes «Correu» i «Persona» (àlies + nom + cognom).
    mask: ['app-data-table tbody td:nth-child(1)', 'app-data-table tbody td:nth-child(2)'],
  },
  {
    file: '06-usuari-accions.png',
    app: 'dashboard',
    path: '/config/users',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menu').waitFor();
    },
    highlight: '[role="menu"]',
    mask: ['app-data-table tbody td:nth-child(1)', 'app-data-table tbody td:nth-child(2)'],
  },
  {
    file: '06-usuari-nou.png',
    app: 'dashboard',
    path: '/config/users',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Crea usuari' }).click();
      await page.getByRole('dialog', { name: 'Crea usuari' }).waitFor();
    },
    clip: 'dialog[open] .modal-box',
  },
  {
    // Només ADMIN veu «Assignar rol». Si l'usuari E2E és TECHNICAL, esta captura falla:
    // traieu-la de la llista i descriviu el modal amb text.
    file: '06-assignar-rol.png',
    app: 'dashboard',
    path: '/config/users',
    ready: 'app-data-table tbody tr',
    prepare: async (page) => {
      await page.getByRole('button', { name: 'Accions' }).first().click();
      await page.getByRole('menuitem', { name: 'Assignar rol' }).click();
      await page.getByRole('dialog', { name: 'Assignar rol' }).waitFor();
    },
    // El modal mostra el correu de l'usuari.
    mask: ['dialog[open] .modal-box > p'],
    clip: 'dialog[open] .modal-box',
  },
];
```

Revisa abans d'executar:
- `.modal-box` és la classe que posa `boxClasses()` de `lib-modal` (verificat a `libs/ui/src/lib/components/modal/modal.component.ts`).
- El text del modal «Assignar rol» (`<p class="text-sm text-base-content/60 mb-4">`) és fill del cos del modal, no directament de `.modal-box`. Ajusta `mask` a `dialog[open] p:has-text("@")` si el primer no el tapa.
- La captura de la confirmació «Eliminar etiqueta», «Eliminar temporada» o «Desactivar usuari» **no** es fa: no aporta res i és fàcil confirmar-la per error.

- [ ] **Step 2: Afig `s03` a `shots/index.ts`**
- [ ] **Step 3: Executa-ho**

Run: `pnpm run dev:up && E2E_EMAIL=… E2E_PASSWORD=… SHOTS=04,05,06 pnpm run docs:manual-shots`
Expected: 11 PNG a `docs/manual/img/` (10 si s'ha tret `06-assignar-rol.png`).

- [ ] **Step 4: Revisa cada PNG a mà**
  - cap nom, cognom ni correu visible (llevat de l'àlies);
  - el contorn vermell és on toca;
  - `04-panell-filtre-etiqueta.png` ensenya la llista d'etiquetes oberta;
  - `04-assistent-etiquetatge.png` té el nom de la fitxa tapat.
- [ ] **Step 5: Commit**

```bash
git add apps/dashboard-e2e/src/manual/shots/s03.ts apps/dashboard-e2e/src/manual/shots/index.ts docs/manual/img/04-*.png docs/manual/img/05-*.png docs/manual/img/06-*.png
git commit -m "docs(manual): add screenshots for tags, seasons and users"
```

---

## Task B: `04-etiquetes.md`

**Files:** Create `docs/manual/04-etiquetes.md`

Primera línia: `<!-- rutes: /config/tags /config/tags/:id -->`

### Esquema

**`# Etiquetes`**

**Per a què serveix.** Les etiquetes diuen què fa cada persona a la colla: pinya, tronc, xicalla o altres. Serveixen per a trobar ràpid la gent adequada quan col·loqueu persones en una figura. També marquen qui encara està per revisar.

**On és.** «Configuració» → targeta «Etiquetes». La llista d'una etiqueta s'obri fent clic a la seua fila.

Captura principal: `![Llista d'etiquetes](img/04-etiquetes-llista.png)`

**Secció «Grups d'etiquetes».** Una taula curta. Cada etiqueta té una «Categoria», que és el seu grup. Hi ha 4 grups fixos i no se'n poden crear més:

| Categoria | Per a què | Exemples del catàleg |
|---|---|---|
| Pinya | llocs de pinya | 1es Mans, 1es Vents, Segon Cordó, Laterals / Diagonals, Agulles, Contraforts, Crosses, Taps, Cordó Obert, Persones Noves |
| Tronc | pisos, base i direcció | Baixes, Segones, Terces, Alçadores, Figures SP / Figures Netes, No troncs, Tècnica |
| Xicalla | xicalla que participa | Xicalla, Xiquets/es de la colla |
| Altres | qui no fa ni pinya ni tronc | Acompanyants, Fem Pinya, Imatge i Paradeta |

Nota: els exemples són el catàleg inicial de `docs/TAGS.md` §2. **Abans d'escriure-la, compara-ho amb `/config/tags` de la BD de desenvolupament** i posa-hi els noms reals.

Frase clau: les etiquetes són només de MuixerApp. L'app antiga no en porta cap, i la sincronització no en crea ni n'esborra (enllaç a `02-dades-app-antiga.md`).

**Secció «Com fan servir les etiquetes l'assignació»** (és la secció més important de la pàgina; text pla, sense «positionType»):
- Explica «Posicions de figura»: cada etiqueta pot apuntar a un o més tipus de lloc de les figures. Per exemple, «1es Mans» apunta a MANS.
- Quan seleccioneu un lloc d'una figura a l'espai de treball del segment, el panell «Persones» posa primer qui porta una etiqueta que apunta a eixe tipus de lloc. Al costat del seu àlies hi ha un punt del color de l'etiqueta.
- És **només un ordre i una ajuda visual**. No tria ningú per vosaltres, no amaga ningú i no impedeix posar ningú enlloc.
- També podeu filtrar el panell a mà amb el botó «Totes les etiquetes»: només hi queda la gent amb l'etiqueta triada. Per a tornar a veure tothom, feu clic a «✕».
- Captura: `![Filtre d'etiqueta al panell de persones](img/04-panell-filtre-etiqueta.png)`
- Què vol dir per a vosaltres: si una persona no puja quan toca, reviseu dues coses: que porte l'etiqueta i que l'etiqueta tinga marcat eixe tipus de lloc a «Posicions de figura». Si el lloc de la plantilla no té «Tipus de posició», no puja ningú (enllaç a `09-plantilles-pinya.md` i `10-plantilles-tronc.md`).
- Les etiquetes de Xicalla i d'Altres no tenen «Posicions de figura». No ordenen, però es poden fer servir al filtre.

**Pas a pas** (numerat):
1. *Crear una etiqueta.* Feu clic a «Etiqueta nova». Ompliu «Nom» i trieu «Categoria» (obligatoris), després «Color». A «Posicions de figura» només apareixen els grups de la categoria triada: «Pinya» per a Pinya; «Tronc», «Direcció» i «Base» per a Tronc. Obriu el grup i feu clic als tipus de lloc. Opcionalment, «Descripció curta» i «Descripció llarga». Feu clic a «Crea».
   - Captura: `![Posicions de figura](img/04-etiqueta-posicions.png)`
   - Consell (de `docs/TAGS.md`): els noms van en plural, com a rol de la colla («Segones», no «Segona»).
2. *Canviar una etiqueta.* «Edita» a la fila → «Alça». Si canvieu la «Categoria», es perden els tipus de lloc que no són d'eixa categoria.
3. *Etiquetar moltes persones seguides: assistent «Etiqueta persones».*
   - Obriu-lo amb «Etiqueta persones».
   - Pestanya «Pendents»: només les persones actives que no compleixen la regla mínima. Pestanya «Tothom»: totes les persones actives, per ordre de primer cognom.
   - Per a cada persona veieu una fitxa: àlies, «Menor de 16» si escau, «Alçada d'espatlles» i observacions. A sota hi ha un bloc per grup amb un comptador «N / M».
   - Feu clic a una etiqueta per a posar-la o llevar-la. **S'alça al moment**: no hi ha botó «Alça».
   - «Següent» / «Anterior» per a canviar de persona; «Salta a una persona...» per a anar a algú concret. «Veu el detall» obri la fitxa de la persona en una pestanya nova.
   - Captura: `![Assistent d'etiquetatge](img/04-assistent-etiquetatge.png)`
4. *La regla mínima* (un bloc curt): una persona està «ben etiquetada» si té almenys una etiqueta de Xicalla, **o** almenys una d'Altres, **o** almenys una de Pinya **i** una de Tronc. Si no, apareix «Falten etiquetes» a la llista de Persones i compta a l'avís «N persones pendents d'etiquetar» de la pantalla Etiquetes. La regla no bloqueja res: només avisa. Enllaç a `03-persones.md` (filtre «Etiquetes» → «Falten etiquetes»).
   - Les persones creades al Dashboard reben «Persones Noves» (Pinya) si no se'ls posa cap etiqueta de Xicalla ni d'Altres. Per això apareixen com a pendents fins que algú els posa una de Tronc. Les que arriben de l'app antiga no porten cap etiqueta.
5. *Veure i canviar qui porta una etiqueta.* Feu clic a la fila de l'etiqueta. A dalt hi ha el color, la categoria, els tipus de lloc i «N persones».
   - Per a afegir algú, escriviu a «Cerca persona per afegir...» i trieu-lo: s'afig al moment.
   - Per a llevar-lo, feu clic a «Lleva» (la icona ✕ de la fila) i confirmeu amb «Lleva».
   - Captura: `![Detall d'una etiqueta](img/04-etiqueta-detall.png)`
6. *Esborrar una etiqueta.* Primer heu de llevar-la de totes les persones. Si encara en té, el modal ja avisa («Aquesta etiqueta té N persones assignades.») i en confirmar apareix l'error «No es pot esborrar: hi ha persones amb aquesta etiqueta assignada.».

**Si sou de pinyes.** Les etiquetes de Pinya són les que fan pujar la gent quan seleccioneu un lloc de pinya (MANS, VENT, LATERAL…). Les tres de mans/vents («1es Mans», «1es Vents», «Segon Cordó») apunten als mateixos tipus de lloc. El panell no distingix primeres de segones: les dues pugen igual. Vegeu `13-assignacio-pinyes.md`.

**Si sou de troncs o xicalla.**
- Les etiquetes de Tronc apunten a pisos (Segona, Terça, Alçadora…), a «Base» i, en el cas de «Tècnica», a les direccions.
- La xicalla: la casella «Xicalla» del panell de persones no mira l'etiqueta del grup Xicalla, mira «Menor de 16» de la fitxa. Ve desmarcada. Si no veieu cap infant al panell, marqueu-la.
- Per a filtrar per l'etiqueta «Xicalla», feu servir «Totes les etiquetes».
- Vegeu `12-assignacio-troncs.md`.

**Compte amb.**
- Una etiqueta no col·loca ningú ni impedeix col·locar ningú. Si algú està mal posat, no és culpa de l'etiqueta.
- «Posicions de figura» buit = l'etiqueta no ordena mai res, però continua servint per a filtrar i per a la regla mínima.
- «Menor de 16» i l'etiqueta «Xicalla» són coses diferents: una és l'edat, l'altra si participa a les figures.
- El filtre per categoria de la llista només té «Totes», «Pinya» i «Tronc».
- En l'assistent, a «Pendents», l'última persona no deixa avançar amb «Següent» fins que compleix la regla.

**Relacionat.** `03-persones.md` (etiquetes des de la fitxa i filtre «Falten etiquetes») · `12-assignacio-troncs.md` · `13-assignacio-pinyes.md` · `17-participacio.md` (filtre «Totes les etiquetes») · `09-plantilles-pinya.md` / `10-plantilles-tronc.md` («Tipus de posició»).

- [ ] **Step 1:** Escriu la pàgina amb l'esquema de dalt.
- [ ] **Step 2:** Verificació: `nx serve dashboard`, obri `/config/manual/04-etiquetes`. Comprova que les 4 imatges carreguen i que els enllaços interns naveguen.
- [ ] **Step 3:** Checklist de llengua del pla arrel. Atenció a «posar/llevar» (no «treure») i a «alçar».
- [ ] **Step 4:** Commit: `git add docs/manual/04-etiquetes.md && git commit -m "docs(manual): add tags page"`

---

## Task C: `05-temporades.md`

**Files:** Create `docs/manual/05-temporades.md`

Primera línia: `<!-- rutes: /config/seasons -->`

### Esquema

**`# Temporades`**

**Per a què serveix.** Una temporada és un període amb data d'inici i data de fi. Serveix per a agrupar assajos i actuacions i per a les estadístiques d'assistència de cada membre a la PWA.

**On és.** «Configuració» → targeta «Temporades».

Captura principal: `![Llista de temporades](img/05-temporades-llista.png)`

**Idea clau (en un requadre o paràgraf curt).** Un assaig o una actuació **no es posa** dins d'una temporada a mà. Cau dins de la temporada que conté la seua data.
- Les temporades no es poden solapar, i per això cada data té com a molt una temporada.
- Si canvieu les dates d'una temporada, els events canvien de temporada sols.

**Pas a pas.**
1. *Llegir la llista.* Columnes «Nom», «Data inici», «Data fi», «Esdeveniments» i «Accions». La temporada d'avui porta la insígnia «Actual». A «Esdeveniments», «N assajos» i «N actuacions» són enllaços: obrin la llista d'Assajos o d'Actuacions ja filtrada per eixa temporada.
2. *Crear la temporada següent.* Feu clic a «Temporada nova». Ompliu «Nom» (p. ex. «Temporada 2026-2027»), «Data inici», «Data fi» i, si voleu, «Descripció». Feu clic a «Crea».
   - Captura: `![Temporada nova](img/05-temporada-nova.png)`
   - **Feu-ho abans de crear el primer assaig de la temporada nova.** Sense temporada no es pot crear cap event en eixes dates (enllaç a `07-assajos-i-actuacions.md`).
3. *Moure la frontera entre dues temporades.*
   - Com que no es poden solapar, primer escurceu la temporada que acaba. Si això deixa events fora, el formulari avisa («N esdeveniments quedaran sense temporada. Voleu continuar?») i el botó canvia a «Alça igualment».
   - Després allargueu l'altra temporada perquè els torne a cobrir.
4. *Esborrar una temporada.* «Elimina» → el modal «Eliminar temporada» diu quants events quedaran sense temporada → «Elimina».

**Events fora de temporada.**
- Si n'hi ha, la pantalla mostra a dalt: «Hi ha N esdeveniments que no estan dins de cap temporada.».
- Solen ser events antics que han vingut de l'app antiga: la sincronització els importa igualment.
- Un event fora de temporada no compta per a cap estadística de temporada. Al formulari d'edició es veu com «Sense temporada».
- L'avís no diu quins són. Per a trobar-los, a Assajos o Actuacions mireu la columna «Temporada» (s'activa a «Columnes visibles»): hi tenen «—».
- Per a arreglar-ho, creeu o allargueu una temporada que cobrisca eixes dates.

**Compte amb.**
- «Data fi» ha de ser posterior a «Data inici» («La data fi ha de ser posterior a la data d'inici»).
- No pot haver-hi dues temporades amb el mateix nom ni amb dates solapades: l'error ix a dalt del formulari.
- Esborrar una temporada no esborra cap event, però els deixa «Sense temporada», i llavors ja no podreu canviar-los la data si la nova data tampoc no és dins de cap temporada.

**Relacionat.** `07-assajos-i-actuacions.md` · `02-dades-app-antiga.md` · `19-pwa.md` (estadístiques del perfil del membre).

No hi ha blocs per perfil: la feina és la mateixa per a tothom.

- [ ] **Step 1:** Escriu la pàgina.
- [ ] **Step 2:** Verificació a `/config/manual/05-temporades` (2 imatges, enllaços).
- [ ] **Step 3:** Checklist de llengua.
- [ ] **Step 4:** Commit: `git add docs/manual/05-temporades.md && git commit -m "docs(manual): add seasons page"`

---

## Task D: `06-usuaris-i-acces.md`

**Files:** Create `docs/manual/06-usuaris-i-acces.md`

Primera línia: `<!-- rutes: /config/users /config/legal -->`

### Esquema

**`# Usuaris i accés`**

**Per a què serveix.** Decidir qui pot entrar a MuixerApp i què hi pot fer.

**On és.** «Configuració» → targeta «Usuaris». La targeta «Privacitat i legal» només la veuen els administradors.

Captura principal: `![Llista d'usuaris](img/06-usuaris-llista.png)`

**Secció «Persones i usuaris no són el mateix».**
- Una **persona** és algú de la colla: és al cens (pantalla Persones) i té assistència i llocs a les figures. Quasi totes venen de l'app antiga.
- Un **usuari** és un compte per a entrar a l'app, amb correu i contrasenya.
- Una persona pot no tindre usuari: no entra mai a l'app, però es pot col·locar igual.
- Un usuari es pot vincular a una persona: és el que permet a un membre apuntar-se des del mòbil.
- La xicalla no té usuari propi: ho gestiona un adult responsable (enllaç a `03-persones.md`).

**Secció «Rols»** (taula en paraules planes; els noms són els de la UI):

| Rol a la UI | Què pot fer |
|---|---|
| «Membre» | només l'app del mòbil (PWA): apuntar-se, veure on li toca. **No pot entrar al Dashboard.** |
| «Tècnica» | tot el Dashboard i la PWA amb les opcions de tècnica («Passa llista», recomptes) |
| «Administrador» | el mateix que «Tècnica» i, a més: «Assignar rol», «Privacitat i legal», la sincronització amb l'app antiga i tocar comptes d'administrador |

**Pas a pas.**
1. *Donar accés a un membre (el cas normal): enllaç d'invitació.* Es fa des de la fitxa de la persona, no des d'esta pantalla:
   1. Persones → la persona → secció del compte → «Crea enllaç d'invitació».
   2. L'enllaç es copia al portapapers. Si el navegador no ho permet, apareix dins del missatge verd.
   3. **L'app no envia cap correu.** Heu d'enviar l'enllaç vosaltres (WhatsApp, correu…).
   4. La persona l'obri al mòbil, a la pantalla «Activa el teu compte» de la PWA, i tria la contrasenya.
   5. Mentre no l'activa, la fitxa diu «Pendent d'activar». Després diu «Compte actiu».
   6. L'enllaç caduca a les 72 hores. Si caduca, torneu a fer clic a «Crea enllaç d'invitació»: se'n fa un de nou i l'anterior deixa de valdre.
   - Detall i captura: `03-persones.md`. Ací només s'explica el flux.
2. *Crear un compte de tècnica directament.* Feu clic a «Crea usuari».
   - Opcionalment trieu «Persona vinculada» («Cerca persona per vincular...»). Si la persona ja té compte, avisa: «Esta persona ja està vinculada a un altre usuari.».
   - Ompliu «Correu electrònic» i «Contrasenya temporal» (mínim 8 caràcters).
   - Trieu el «Rol *». Una tècnica només pot triar «Tècnica»; un administrador també pot triar «Administrador».
   - Feu clic a «Crea usuari».
   - Captura: `![Crea usuari](img/06-usuari-nou.png)`
   - Doneu la contrasenya a la persona per un canal privat i digueu-li que la canvie. Al Dashboard no hi ha opció per a canviar-la: es fa a la PWA (Perfil → Configuració → «Contrasenya») o amb «Heu oblidat la contrasenya?».
3. *Buscar usuaris.* Filtres «Cerca» (correu, nom), «Rols», «Sols actius» i «Amb accés» (comptes que ja tenen contrasenya, és a dir, que han activat el compte). La columna «Invitació expira» està amagada: activeu-la a «Columnes visibles».
4. *Accions d'una fila* (botó «…» a la dreta, «Accions»):
   - Captura: `![Accions d'un usuari](img/06-usuari-accions.png)`
   - «Editar»: canviar el correu o la persona vinculada. El rol no es canvia ací.
   - «Assignar rol» (només administradors): trieu «Membre», «Tècnica» o «Administrador» → «Confirma». És com un membre que ja té compte passa a ser tècnica.
     - Captura (si s'ha pogut fer): `![Assignar rol](img/06-assignar-rol.png)`
   - «Desactivar» → «Desactiva»: la persona perd l'accés **al moment**, també a les sessions que tenia obertes. «Activar» → «Activa» li'l torna.

**Si sou de pinyes / Si sou de troncs o xicalla.** No n'hi ha: la feina és la mateixa.

**Secció curta «Privacitat i legal» (només administradors).**
- Hi ha dos textos: «Política de Privacitat» i «Avís de confidencialitat».
- «Desa correcció» canvia el text sense demanar res a ningú. Serveix per a faltes i detalls.
- «Publica versió nova (cal reacceptar)» obliga **tots els usuaris** a tornar-lo a acceptar la pròxima vegada que entren.
- «Veure historial de versions» mostra les versions anteriors.
- Una línia: si no sou administradors, no veureu esta targeta. És normal.

**Compte amb.**
- Un membre que intenta entrar al Dashboard torna a la pantalla d'entrada: no té permís.
- La xicalla no pot rebre invitació: a la seua fitxa el botó «Crea enllaç d'invitació» està desactivat. Primer cal l'adult responsable.
- No podeu canviar-vos el rol ni desactivar-vos el compte.
- Una tècnica no pot desactivar ni canviar un compte d'administrador.
- «Crea usuari» no serveix per a fer membres: per a membres, l'enllaç d'invitació.

**Relacionat.** `03-persones.md` (enllaç d'invitació, adult responsable, delegacions) · `19-pwa.md` (activar el compte, què veu un membre) · `01-primers-passos.md` (entrar i eixir).

- [ ] **Step 1:** Escriu la pàgina.
- [ ] **Step 2:** Verificació a `/config/manual/06-usuaris-i-acces` (3-4 imatges, enllaços).
- [ ] **Step 3:** Checklist de llengua. Els noms de les accions de fila («Editar», «Assignar rol», «Desactivar», «Activar») es copien tal com són a la UI encara que siguen infinitius.
- [ ] **Step 4:** Commit: `git add docs/manual/06-usuaris-i-acces.md && git commit -m "docs(manual): add users and access page"`

---

## Notes per a la demo

**Temps total del bloc: 15 min** (etiquetes 9 · temporades 3 · usuaris 3).

**Etiquetes (9 min). És el bloc on més dubtes hi haurà.**
1. (1 min) `/config/tags`: els 4 grups i l'avís «N persones pendents d'etiquetar». Obriu «Edita» a «1es Mans» i ensenyeu «Posicions de figura» (no alceu res: «Cancel·la»).
2. (3 min) «Etiqueta persones» → «Pendents». Etiqueteu en directe 1 o 2 persones reals que falten (que algú de troncs diga quina etiqueta de tronc toca). Remarqueu que s'alça al moment. **Pantalla compartida:** la fitxa ensenya nom i cognoms; si no voleu mostrar-los, feu-ho des de la pestanya «Tothom» amb una persona coneguda per tothom.
3. (4 min) Canvieu a l'espai de treball d'un segment amb figures (el dels `TARGETS` o el de l'actuació que es prepara). Seleccioneu un lloc de MANS:
   - ensenyeu qui puja i el punt de color;
   - seleccioneu un lloc de tronc (Segona) i ensenyeu com canvia l'ordre;
   - obriu «Totes les etiquetes» i filtreu per «Xicalla»;
   - marqueu la casella «Xicalla» i ensenyeu la diferència.
4. (1 min) Missatge final: les etiquetes ordenen i filtren; no trien ningú ni bloquegen res.

**Què ha de mirar cada perfil:**
- Pinyes: que «1es Mans» i «Segon Cordó» pugen igual als llocs de mans.
- Troncs: «Baixes» → Base, «Tècnica» → direccions.
- Xicalla: la casella «Xicalla» del panell, i que la xicalla etiquetada amb «Xicalla» però sense «Menor de 16» sí que es veu sense marcar-la.

**Temporades (3 min).** `/config/seasons`: «Actual» i l'enllaç «N assajos». Si hi ha l'avís d'events fora de temporada, expliqueu-lo. Pregunteu si ja hi ha la temporada vinent creada. Si no, es crea en directe, perquè sense ella no es poden crear assajos de la temporada vinent.

**Usuaris (3 min).** Expliqueu persona ≠ usuari i els tres rols. A la fitxa d'una persona sense compte, ensenyeu «Crea enllaç d'invitació» i remarqueu que **no s'envia cap correu**. A `/config/users` no compartiu la pantalla amb la llista sense filtrar: ensenya correus. Filtreu per «Rols» → «Tècnica» o expliqueu-ho amb la captura del manual.

**Preguntes probables:**
- «Per què X no m'ix primer al panell si és de mans?» → no porta l'etiqueta, o l'etiqueta no té MANS a «Posicions de figura», o el lloc de la plantilla no té «Tipus de posició».
- «Puc fer etiquetes noves?» → sí, «Etiqueta nova». Els grups, no.
- «Les etiquetes vénen de l'app antiga?» → no, són només d'esta app, i la sincronització no les toca.
- «He enviat la invitació i no li ha arribat res» → l'app no envia correus; cal passar l'enllaç a mà.
- «Com faig tècnica algú que ja és membre?» → un administrador, amb «Assignar rol».
- «Per què no puc crear l'assaig del setembre?» → falta la temporada nova.
