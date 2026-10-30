# Assistent de persones (etiquetes + gènere + participació + eliminació) — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'assistent d'etiquetatge (`app-tagging-wizard-modal`) passa a ser l'eina de revisió ràpida de persones: a més de les etiquetes, permet posar el gènere, mostra l'assistència i la participació en pinyes, permet a un ADMIN eliminar la persona, i s'obri també des de `/persons`.

**Architecture:** Backend: filtre nou `missing` a `GET /persons` (el reutilitza el pla 4). Frontend: el component existent creix (sense moure'l de `features/config/components/tagging-wizard-modal/`); la util de cua generalitza el criteri de «fet» per mode; reutilitza `GET /persons/:id/participation` i `app-person-remove-modal` del pla 2.

**Tech Stack:** NestJS 11 + Jest/testcontainers; Angular 21 (standalone, OnPush, Signals, `rxResource`), `@muixer/ui`, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-05-person-tagging-wizard-design.md` (original) + §Decisions d'aquest pla, que el modifiquen.

**Depén de:** pla 2 (`2026-10-29-2-person-remove.md`) Tasks 1–3 i 5 (`PersonParticipation`, `PersonService.getParticipation`, `app-person-remove-modal`).

## Decisions

- Canvi respecte a l'spec original: el gènere **sí** es mostra i s'edita: hi ha vistes que el necessiten (p. ex. el mode Gènere del workspace de pinyes) i ha de ser fàcil d'emplenar (petició de l'usuari, 2026-10-30). Edat, telèfon i data d'ingrés continuen ocults.
- Modes: `pending` (Falten etiquetes, el d'ara), `noGender` (Sense gènere), `all` (Tothom). En `noGender` una persona surt de la cua quan té gènere; en `pending`, quan complix la regla d'etiquetes (com ara).
- Gènere: xips `lib-badge clickable` amb les etiquetes de `GENDER_LABELS` (avui a `person-detail.component.ts:60`; es mouen a `persons/models/person.model.ts` i la fitxa les importa d'allí). Clicar el seleccionat el deixa a `null`. Desat optimista amb `PersonService.update(id, { gender })`, revertit si falla (mateix patró que les etiquetes).
- Participació: bloc compacte sota la fitxa, carregat per persona amb `rxResource` (la resposta d'una persona anterior no sobreescriu l'actual).
- Eliminar: botó «Elimina…» només ADMIN; obri `app-person-remove-modal`, que ja decideix entre eliminar definitivament (sense assistències ni pinyes) i esborrar les dades personals (amb historial). En `removed` (qualsevol mode) la persona surt de la cua i l'índex es queda dins de rang.
- Entrades: `/config/tags` (botó «Etiqueta persones», mode inicial `pending`, com ara) i `/persons` (botó de capçalera «Revisa persones», mode inicial `all`). El modal accepta `initialMode`. Títol del modal: «Assistent de persones».

## Global Constraints

- Les de l'spec original (UI en valencià, standalone/OnPush/Signals, `@muixer/ui`, xips `<lib-badge clickable readableOutlineText [selected]>`, `GET /persons` màxim `limit=100`, icones de test amb `allLucideIconsProvider`).
- Filtre `missing`: `@IsIn(PERSON_MISSING_FIELDS, { each: true })`, accepta valor únic o array (`@Transform` com `positionIds`).
- Sense `Co-Authored-By`.
- Manual: `docs/manual/04-etiquetes.md` (secció de l'assistent, captura `img/04-assistent-etiquetatge.png`) i `docs/manual/03-persones.md` (botó nou); `pnpm run docs:manual-shots`.

## Review Focus

- Posar gènere a l'última persona en mode `noGender` i prémer «Següent»: l'índex no es trenca (mateix comportament que l'spec original amb etiquetes).
- Eliminar o anonimitzar l'última persona de la cua: estat buit, sense persona actual.
- Canviar ràpid de persona mentre carrega la participació: es mostra la de la persona actual, no l'anterior.
- Error en desar el gènere: el xip torna al valor anterior i apareix un toast d'error.
- TECHNICAL obri l'assistent: no veu «Elimina…»; tota la resta funciona.

---

### Task 1: Filtre `missing` a `GET /persons`

**Files:**
- Modify: `libs/shared/src/constants/` (fitxer de constants de persona existent, o nou `person-missing-field.ts` exportat a l'index), `apps/api/src/modules/person/dto/person-filter.dto.ts`, `apps/api/src/modules/person/person.service.ts` (on s'apliquen els filtres, prop de `:155`)
- Test: `apps/api/src/modules/person/person-missing-filter.integration.spec.ts`

**Interfaces:**
- Produces:
  - `const PERSON_MISSING_FIELDS = ['gender', 'shoulderHeight', 'birthDate', 'phone', 'account'] as const; type PersonMissingField = typeof PERSON_MISSING_FIELDS[number];`
  - `PersonFilterDto.missing?: PersonMissingField[]` — AND de condicions: `gender IS NULL`, `shoulderHeight IS NULL`, `birthDate IS NULL`, `phone IS NULL OR phone = ''`, `account` ≡ `NOT EXISTS (SELECT 1 FROM users u WHERE u.person_id = person.id)`. Mapa estàtic camp → SQL, mai interpolació del valor.

- [ ] **Step 1: Test que falla:** 3 persones (una sense gènere, una sense alçada, una completa amb compte) → `missing=gender` retorna la primera; `missing=gender&missing=shoulderHeight` cap; `missing=account` no retorna la que té compte; `missing=xyz` → 400.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(api): missing-field filter on persons list`

---

### Task 2: Cua per mode

**Files:**
- Modify: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-queue.util.ts` (+ `.spec.ts`)

**Interfaces:**
- Produces: `type TaggingMode = 'pending' | 'noGender' | 'all'`; `isDone(mode: TaggingMode, person: Pick<Person,'positions'|'gender'>): boolean` (`all` → sempre `false`); `advance(people, index, delta, mode)` usa `isDone` en lloc de `isTagCompliant` directament.

- [ ] **Step 1: Tests que fallen:** en `noGender`, avançar des d'una persona amb gènere la treu de la cua; sense gènere, es queda. Els tests existents de `pending`/`all` continuen igual.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(dashboard): wizard queue supports missing-gender mode`

---

### Task 3: Gènere + participació + eliminació al modal

**Files:**
- Modify: `apps/dashboard/src/app/features/config/components/tagging-wizard-modal/tagging-wizard-modal.component.{ts,html,spec.ts}`, `apps/dashboard/src/app/features/persons/models/person.model.ts` (`GENDER_LABELS`), `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.ts` (importa `GENDER_LABELS`)

**Interfaces:**
- Consumes: `missing` (Task 1), `isDone` (Task 2), `PersonService.getParticipation`, `app-person-remove-modal` (pla 2).
- Produces: `initialMode = input<TaggingMode>('pending')`.

Detalls:
- Pestanyes de mode: «Falten etiquetes» · «Sense gènere» · «Tothom». `reload()` en `noGender` afig `missing: ['gender']`.
- Fila de gènere sota el nom, abans de les etiquetes: etiqueta «Gènere» + xips.
- Bloc «Participació»: «Assistència: X assajos · Y actuacions (N respostes)» i «Pinyes: N posicions en M esdeveniments · darrera dd/MM/yyyy» (o «Encara no ha participat en cap pinya.»). Mentre carrega, `loading-dots` del sistema de disseny o skeleton existent.
- Peu: botó «Elimina…» (`lib-button variant="error" outlineMode size="sm"`) si `authService.isAdmin()`.

- [ ] **Step 1: Tests que fallen:** clic al xip «Dona» fa `PATCH /api/persons/p1 {gender:'FEMALE'}` i el xip queda seleccionat; si la petició falla torna a `null`; la participació es demana per a la persona actual i es pinta; canviar de persona abans que responga la primera no pinta la resposta antiga; «Elimina…» no existeix per a TECHNICAL; `removed` (tant `deleted` com `anonymized`) treu la persona de `people()`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS; `nx test dashboard` verd (la fitxa usa `GENDER_LABELS` mogut).
- [ ] **Step 5: Commit** `feat(dashboard): wizard edits gender, shows participation, admin delete`

---

### Task 4: Entrada des de `/persons` + docs

**Files:**
- Modify: `apps/dashboard/src/app/features/persons/components/person-list.component.{ts,html}` (signal `wizardOpen`, botó a `app-page-header`, `@if (wizardOpen()) <app-tagging-wizard-modal initialMode="all" (closed)="onWizardClosed()" />`; en tancar, recarrega la llista), `docs/superpowers/specs/2026-10-05-person-tagging-wizard-design.md` (nota: el gènere ara es mostra, vegeu este pla), `docs/manual/04-etiquetes.md`, `docs/manual/03-persones.md`

- [ ] **Step 1: Test que falla** (`person-list.component.spec.ts`): el botó «Revisa persones» obri el modal; en `closed` es torna a carregar la llista.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS; `nx lint dashboard`.
- [ ] **Step 5:** Manual + `pnpm run docs:manual-shots`.
- [ ] **Step 6: Commit** `feat(dashboard): open person wizard from persons list`
