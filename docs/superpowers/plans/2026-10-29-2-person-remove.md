# Eliminació i anonimització de persones — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ADMIN pot treure una persona de MuixerApp després de veure'n la participació: si no té cap assistència ni cap posició en pinyes, s'elimina definitivament; si en té, només se n'esborren les dades personals (dret a l'oblit) i es conserven l'àlies i l'historial.

**Architecture:** Backend: `GET /persons/:id/participation` (resum + `canHardDelete`; el reutilitza el pla 3), `DELETE /persons/:id/permanent` (ADMIN, 409 si té historial) i `POST /persons/:id/anonymize` (ADMIN), tots dos en transacció. Columna nova `persons.anonymizedAt`; la sincronització amb l'app antiga salta les persones anonimitzades. Frontend: component reutilitzable `app-person-remove-modal` (el reutilitza el pla 3) que tria el camí segons `canHardDelete`.

**Tech Stack:** NestJS 11, TypeORM 0.3 (`dataSource.transaction`), Jest + testcontainers; Angular 21, `@muixer/ui` (`lib-modal`, `lib-button variant="error"`, `lib-input`, `lib-alert`, `lib-badge`), Vitest.

**Spec:** `docs/GDPR_COMPLIANCE.md` §11 i `docs/DEBT.md` **SEC5** (dret a l'oblit), amb les correccions de §Decisions (petició de l'usuari del 2026-10-30).

## Decisions

- **Regla:** l'eliminació definitiva només és possible si la persona té **0 files a `attendances`** (de qualsevol estat) **i 0 a `node_assignments`**. Si no, l'única opció és anonimitzar. L'API ho fa complir (409), no només la UI.
- **L'àlies pertany a la colla** (política de privacitat): l'anonimització el **conserva** (corregeix §11 de `GDPR_COMPLIANCE.md`, que deia buidar-lo). Així les pinyes i l'assistència històriques continuen llegibles i amb integritat referencial.
- **Anonimitzar** (una transacció):
  - `persons`: `name = ''`, `firstSurname = ''`, i `null` a `secondSurname`, `phone`, `birthDate`, `gender`, `shoulderHeight`, `notes`, `notesEmoji`, `joinDate`, `shirtDate`, `mentorId`, `lastSyncedAt`; `isXicallaManual = false`, `isActive = false`, `anonymizedAt = now()`. Es conserven `id`, `alias`, `legacyId` (només per al filtre de sincronització), `createdAt`.
  - `person_positions` (etiquetes) i `person_delegates` de la persona → s'esborren.
  - Altres persones amb `mentorId` = esta → `NULL`.
  - `users` vinculat: `email`, `passwordHash`, `inviteToken`, `inviteExpiresAt`, `resetToken`, `resetExpiresAt` → `null`; `isActive = false`; es revoquen tots els refresh tokens i es desactiven les subscripcions push. Es manté el vincle `person_id` (el compte queda inservible i sense dades).
  - `attendances` i `node_assignments` → intactes.
- **Eliminar definitivament** (sense historial): `persons.mentorId` d'altres → `NULL`; `users.person_id` → `NULL` (el compte no es toca; l'admin el pot desactivar a `/config/users`); `person_delegates` i `person_positions` cauen per CASCADE; esborra la fila.
- Una persona anonimitzada no es pot editar ni reactivar (`PATCH /persons/:id` i `PATCH /persons/:id/activate` → 409) ni tornar a anonimitzar.
- **Sincronització:** `upsertPerson` salta (i compta com a omesa) qualsevol `legacyId` que tinga una persona amb `anonymizedAt`; la sincronització d'assistència tampoc li'n vincula de noves. Una persona eliminada definitivament sí que pot tornar a aparéixer (no té historial; acceptat).
- Confirmació: escriure l'àlies habilita el botó. Les dues accions són irreversibles.
- Auditoria: `PERSON_DELETED` i `PERSON_ANONYMIZED` (`targetType: 'Person'`). La metadata **no** porta dades personals: només `alias` i el resum numèric de participació.
- Fora d'abast (continua a SEC5): l'anonimització automàtica passat el termini des de la baixa (cron).

## Global Constraints

- UI en valencià (`.agents/skills/language-rules/SKILL.md`): botons «Elimina definitivament» / «Esborra les dades personals», missatges en «vós». Codi/commits en anglés.
- Standalone + OnPush + Signals; només `@muixer/ui` i tokens.
- Migració: `apps/api/src/migrations/1786900000000-AddPersonAnonymizedAt.ts` — `ALTER TABLE "persons" ADD "anonymizedAt" timestamptz` + `ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS` per a `PERSON_DELETED` i `PERSON_ANONYMIZED`; `down` només treu la columna (Postgres no treu valors d'enum). Registrada a `migrations/index.ts`. Treu `PERSON_ANONYMIZED` del comentari de reserva de `audit-action.enum.ts`.
- Canvi d'entitat: `pnpm run docs:model` i `pnpm run docs:map`, diff al commit.
- Docs: `docs/DEBT.md` SEC5 queda només amb el cron per termini; `docs/GDPR_COMPLIANCE.md` §11 reflecteix el que s'ha fet i que l'àlies es conserva.
- Sense `Co-Authored-By`.
- Manual: `docs/manual/03-persones.md` (secció nova «Eliminar una persona»); captura nova.

## Review Focus

- Persona amb una sola resposta `NO_VAIG` i cap pinya: `canHardDelete = false`; `DELETE …/permanent` → 409.
- Les pantalles que pinten historial (fitxa d'esdeveniment, projecció, historial de pinyes) amb una persona anonimitzada: mostren l'àlies i no peten amb `name = ''`.
- Sincronitzar després d'anonimitzar una persona amb `legacyId`: no apareix cap persona nova amb eixe `legacyId` i l'anonimitzada no recupera dades.
- El compte vinculat a una persona anonimitzada no pot fer login ni refresh (tokens revocats, `isActive=false`, sense contrasenya).
- Un TECHNICAL crida qualsevol de les dues rutes: 403.

---

### Task 1: Resum de participació

**Files:**
- Create: `libs/shared/src/interfaces/person-participation.interfaces.ts` (+ export a `libs/shared/src/index.ts`)
- Modify: `apps/api/src/modules/person/person.service.ts`, `apps/api/src/modules/person/person.controller.ts`
- Test: `apps/api/src/modules/person/person-participation.integration.spec.ts` (testcontainers, patró de `person-shirt-candidates.integration.spec.ts`)

**Interfaces:**
- Produces:
  ```ts
  interface PersonParticipation {
    attendance: {
      total: number;                                   // files a attendances, qualsevol estat
      byStatus: Partial<Record<AttendanceStatus, number>>;
      attended: { rehearsals: number; performances: number }; // ASSISTIT per eventType, tots els temps
      firstDate: string | null;
      lastDate: string | null;
    };
    assignments: { total: number; events: number; lastDate: string | null };
    delegates: number;      // files person_delegates on apareix
    mentees: number;        // persones amb mentorId = id
    user: { id: string; email: string | null } | null;
    legacyId: string | null;
    anonymizedAt: string | null;
    canHardDelete: boolean; // attendance.total === 0 && assignments.total === 0
  }
  ```
  - `PersonService.getParticipation(id: string): Promise<PersonParticipation>` (404 si no existeix). Estil `COUNT(...) FILTER (WHERE ...)` de `SHIRT_CANDIDATES_QUERY` (`person.service.ts:70`). Dates de pinyes per `node_assignment → figure_instance → event_segment → event`.
  - `GET /persons/:id/participation` (classe: TECHNICAL/ADMIN).

- [ ] **Step 1: Test que falla:** persona amb 2 `ASSISTIT` (1 assaig, 1 actuació), 1 `NO_VAIG`, 1 assignació, 1 mentee i compte → `attendance.total=3`, `byStatus.ASSISTIT=2`, `attended={rehearsals:1,performances:1}`, `assignments.total=1`, `mentees=1`, `canHardDelete=false`. Persona amb només 1 `NO_VAIG` → `canHardDelete=false`. Persona sense res → zeros, `null`, `canHardDelete=true`.
- [ ] **Step 2:** `nx run api:test-integration --testFile=…person-participation.integration.spec.ts` → FAIL.
- [ ] **Step 3:** Implementa. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(api): person participation summary endpoint`

---

### Task 2: Esborrat definitiu (només sense historial)

**Files:**
- Create: `apps/api/src/migrations/1786900000000-AddPersonAnonymizedAt.ts`
- Modify: `apps/api/src/migrations/index.ts`, `libs/shared/src/enums/audit-action.enum.ts`, `apps/api/src/modules/person/person.entity.ts` (`anonymizedAt: Date | null`), `person.service.ts`, `person.controller.ts`, `docs/DATA_MODEL.md`/`docs/MAP.md` (regenerats)
- Test: `apps/api/src/modules/person/person-remove.integration.spec.ts`, `apps/api/src/modules/person/person.controller.spec.ts`

**Interfaces:**
- Consumes: `getParticipation` (Task 1).
- Produces: `PersonService.hardDelete(id: string): Promise<PersonParticipation>`; `DELETE /persons/:id/permanent` → 204, `@Roles(UserRole.ADMIN)`; 409 `'La persona té assistències o posicions en pinyes. Només se'n poden esborrar les dades personals.'` si `!canHardDelete`.

- [ ] **Step 1: Tests que fallen:** persona sense historial amb delegat, etiqueta, mentee i compte → no queda la fila, el mentee té `mentorId NULL`, el `User` existeix amb `person_id NULL`. Persona amb una assistència → `ConflictException` i no s'ha esborrat res. Controller: audita `PERSON_DELETED` amb `metadata: { alias, participation }` i té `@Roles(ADMIN)`.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementa dins `this.dataSource.transaction(async (manager) => …)` (patró `person-delegate.service.ts:115`): torna a comprovar els recomptes **dins** la transacció abans d'esborrar.
- [ ] **Step 4:** → PASS. `pnpm run docs:model && pnpm run docs:map`.
- [ ] **Step 5: Commit** `feat(api): admin-only permanent delete for persons without history`

---

### Task 3: Anonimització (dret a l'oblit)

**Files:**
- Modify: `apps/api/src/modules/person/person.service.ts` (+ `update`/`activate` rebutgen anonimitzades), `person.controller.ts`, `apps/api/src/modules/person/person.module.ts` (injecta `TokenService` i `PushSubscriptionService` o fes els UPDATE amb el `manager` de la transacció — preferible, evita dependències de mòdul)
- Test: `apps/api/src/modules/person/person-remove.integration.spec.ts`

**Interfaces:**
- Produces: `PersonService.anonymize(id: string): Promise<PersonParticipation>`; `POST /persons/:id/anonymize` → 204, `@Roles(UserRole.ADMIN)`; 409 si ja és anonimitzada.

- [ ] **Step 1: Tests que fallen:** persona amb assistència, assignació, etiqueta, delegat, mentee, compte amb push i refresh token → després d'`anonymize`: camps de §Decisions buits/`null`, `alias` i `legacyId` iguals, `anonymizedAt` posat, `isActive=false`; les files d'`attendances` i `node_assignments` hi són; cap etiqueta ni delegat; mentee amb `mentorId NULL`; `User` amb `email=null`, `isActive=false`, tots els refresh tokens amb `revokedAt`, totes les subscripcions `isActive=false`. Segona crida → 409. `PATCH /persons/:id` sobre l'anonimitzada → 409. Audita `PERSON_ANONYMIZED`.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa en una transacció. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(api): anonymize person personal data keeping alias and history`

---

### Task 4: La sincronització respecta les anonimitzades

**Files:**
- Modify: `apps/api/src/modules/sync/strategies/person-sync.strategy.ts:361-375` (`upsertPerson`), `apps/api/src/modules/sync/strategies/attendance-sync.strategy.ts:341-351` (mapa per `legacyId`)
- Test: specs existents d'eixes estratègies (afig-hi els casos)

**Interfaces:**
- Produces: `upsertPerson` retorna `null` (i emet un esdeveniment d'omissió, com la resta d'omissions de l'estratègia) quan existeix una persona amb eixe `legacyId` i `anonymizedAt` no nul; el cridador ho compta com a omesa. El mapa d'assistència exclou les anonimitzades.

- [ ] **Step 1: Tests que fallen:** legacy amb el mateix `id` que una anonimitzada → no es crea cap persona i l'anonimitzada no canvia; el mapa d'assistència no la conté. El cas BUG-9 (desactivada però no anonimitzada → se'n crea una nova) continua igual.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa (consulta per `legacyId` sense filtrar `isActive`; si alguna té `anonymizedAt`, omet). **Step 4:** → PASS; `nx test api` verd.
- [ ] **Step 5:** Docs: `docs/DEBT.md` SEC5 → només el cron per termini; `docs/GDPR_COMPLIANCE.md` §11 → què s'ha implementat i que l'àlies es conserva.
- [ ] **Step 6: Commit** `feat(api): legacy sync skips anonymized persons`

---

### Task 5: Modal al dashboard

**Files:**
- Create: `apps/dashboard/src/app/features/persons/components/person-remove-modal/person-remove-modal.component.{ts,html,spec.ts}`
- Modify: `apps/dashboard/src/app/features/persons/services/person.service.ts` (`getParticipation(id)`, `deletePermanently(id)`, `anonymize(id)`), `apps/dashboard/src/app/features/persons/models/person.model.ts` (`anonymizedAt`), `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.{ts,html}`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces (el pla 3 en depén): `<app-person-remove-modal [person]="Pick<Person,'id'|'name'|'firstSurname'|'alias'>" (removed)="…" (closed)="…" />`. Carrega la participació en obrir; emet `removed` amb `{ id, mode: 'deleted' | 'anonymized' }`.

Contingut:
- Títol «Eliminar <àlies>».
- Participació: «N respostes d'assistència (X assajos i Y actuacions amb assistència confirmada)», «N posicions en pinyes en M esdeveniments», «N delegacions», «És mentor de N persones», «Compte d'usuari: <email>».
- Si `canHardDelete`: `lib-alert variant="warning"` «Esta acció no es pot desfer.» (+ si `legacyId`: «Si sincronitzeu amb l'app antiga, la persona tornarà a aparéixer.») i botó «Elimina definitivament».
- Si no: `lib-alert variant="info"` «Esta persona té historial d'assistència o de pinyes i no es pot eliminar. Podeu esborrar-ne les dades personals: es conserven l'àlies i l'historial, i el seu compte deixa de funcionar. Esta acció no es pot desfer.» i botó «Esborra les dades personals».
- `lib-input` «Escriviu <àlies> per a confirmar»; botó `variant="error"` desactivat fins que coincidix (sense distingir majúscules ni espais als extrems).
- Fitxa: botó «Elimina…» al final, només si `authService.isAdmin()` i `!person.anonymizedAt`. En `removed`: toast «S'ha eliminat la persona.» / «S'han esborrat les dades personals.» i `router.navigate(['/persons'])`. Una fitxa anonimitzada mostra `lib-badge` «Anonimitzada» i no deixa editar.

- [ ] **Step 1: Tests que fallen:** amb `canHardDelete:true` el botó és «Elimina definitivament» i fa `DELETE /api/persons/p1/permanent`; amb `false` és «Esborra les dades personals» i fa `POST /api/persons/p1/anonymize`; desactivat fins escriure l'àlies; emet `removed` amb el mode correcte; a la fitxa el botó no apareix per a TECHNICAL ni per a una anonimitzada.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS; `nx lint dashboard`.
- [ ] **Step 5:** Manual `03-persones.md` («Eliminar una persona»: els dos casos) + `pnpm run docs:manual-shots`.
- [ ] **Step 6: Commit** `feat(dashboard): remove person (delete or anonymize) with participation summary`
