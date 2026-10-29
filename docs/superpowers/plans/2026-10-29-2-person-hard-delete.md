# Eliminació definitiva de persones — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un ADMIN pot eliminar definitivament una persona de MuixerApp després de veure un resum de la seua participació (assistències, pinyes, delegats, compte vinculat) i confirmar-ho.

**Architecture:** Backend: `GET /persons/:id/participation` (resum, TECHNICAL/ADMIN; el reutilitza el pla 3) i `DELETE /persons/:id/permanent` (ADMIN) que, en una transacció, esborra les files que bloquegen el FK i després la persona. Frontend: component reutilitzable `app-person-delete-modal` (el reutilitza el pla 3) obert des de la fitxa de la persona.

**Tech Stack:** NestJS 11, TypeORM 0.3 (`dataSource.transaction`), Jest + testcontainers; Angular 21, `@muixer/ui` (`lib-modal`, `lib-button variant="error"`, `lib-input`, `lib-alert`), Vitest.

**Spec:** cap document separat; decisions a §Decisions.

## Decisions

- `DELETE /persons/:id` continua sent el soft delete (`isActive=false`); l'esborrat físic és una ruta nova i explícita: `DELETE /persons/:id/permanent`, **només ADMIN**.
- Què passa amb cada referència (FK reals, vegeu `migrations/1748600000000-InitialSchema.ts`):
  - `attendances` (NO ACTION) → s'esborren.
  - `node_assignments` (RESTRICT) → s'esborren (el node queda buit; els `InstanceNode` no es toquen).
  - `persons.mentorId` d'altres persones (NO ACTION) → `NULL`.
  - `users.person_id` (NO ACTION) → `NULL`: el compte **no** s'esborra ni es desactiva; queda sense persona vinculada (l'admin el pot desactivar a `/config/users`). El diàleg ho avisa.
  - `person_delegates`, `person_positions` → CASCADE de la BD, res a fer.
- Sincronització: si la persona té `legacyId`, la pròxima sincronització amb l'app antiga la tornarà a crear (sense historial). No guardem cap llista d'exclusió (acceptat per l'usuari). El diàleg ho diu.
- Confirmació: escriure l'àlies de la persona (o el nom si no en té) habilita el botó. Acció irreversible.
- Auditoria: `AuditAction.PERSON_DELETED`, `targetType: 'Person'`, `metadata` = nom, àlies, `legacyId` i el resum de participació (és l'únic rastre que queda).

## Global Constraints

- UI en valencià (`.agents/skills/language-rules/SKILL.md`): botó «Elimina definitivament», missatges en «vós». Codi/commits en anglés.
- Standalone + OnPush + Signals; només `@muixer/ui` i tokens.
- Migració: `apps/api/src/migrations/1786900000000-AddPersonDeletedAuditAction.ts` (`ALTER TYPE "audit_action_enum" ADD VALUE IF NOT EXISTS 'PERSON_DELETED'`; `down` buit amb comentari: Postgres no treu valors d'un enum), registrada a `migrations/index.ts`. Treu `PERSON_ANONYMIZED` del comentari de reserva? **No**: és una altra cosa (dret a l'oblit, `docs/DEBT.md` SEC5).
- Sense `Co-Authored-By`.
- Manual: `docs/manual/03-persones.md` (secció nova «Eliminar una persona», i a «Compte amb» la nota de la sincronització); captura nova.

## Review Focus

- Persona amb un compte d'usuari vinculat: l'eliminació funciona i el `users.person_id` queda `NULL`; el login d'eixe compte continua funcionant (la PWA mostra el `no-person-banner`).
- Persona que és mentor d'altres: els mentees queden amb `mentorId = NULL`, no es trenca res.
- Un TECHNICAL crida `DELETE /persons/:id/permanent`: 403.
- Error a mitja transacció (p. ex. FK no prevista): no queda res esborrat a mitges (rollback) i la resposta és 409 amb missatge clar, no 500.
- L'admin elimina la persona vinculada al seu propi compte: permés; el dashboard continua (només perd `hasLinkedPerson`).

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
      total: number;                                   // files a attendances
      byStatus: Partial<Record<AttendanceStatus, number>>;
      attended: { rehearsals: number; performances: number }; // ASSISTIT per eventType, tots els temps
      firstDate: string | null;                        // data de l'esdeveniment més antic amb fila
      lastDate: string | null;
    };
    assignments: { total: number; events: number; lastDate: string | null };
    delegates: number;      // files person_delegates on és person o delegate
    mentees: number;        // persones amb mentorId = id
    user: { id: string; email: string | null } | null;
    legacyId: string | null;
  }
  ```
  - `PersonService.getParticipation(id: string): Promise<PersonParticipation>` (404 si no existeix). Una consulta per bloc; reutilitza l'estil `COUNT(...) FILTER (WHERE ...)` de `SHIRT_CANDIDATES_QUERY` (`person.service.ts:70`). Les dates de pinyes van per `node_assignment → figure_instance → event_segment → event`.
  - `GET /persons/:id/participation` (classe: TECHNICAL/ADMIN), declarat **abans** de `GET :id` si cal per l'ordre de rutes.

- [ ] **Step 1: Test que falla:** persona amb 2 `ASSISTIT` (1 assaig, 1 actuació), 1 `NO_VAIG`, 1 assignació, 1 mentee i compte vinculat → `attendance.total=3`, `byStatus.ASSISTIT=2`, `attended={rehearsals:1,performances:1}`, `assignments.total=1`, `mentees=1`, `user.email` correcte. Persona sense res → tots 0 / `null`.
- [ ] **Step 2:** `nx run api:test-integration --testFile=…person-participation.integration.spec.ts` → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(api): person participation summary endpoint`

---

### Task 2: Esborrat físic

**Files:**
- Create: `apps/api/src/migrations/1786900000000-AddPersonDeletedAuditAction.ts`
- Modify: `apps/api/src/migrations/index.ts`, `libs/shared/src/enums/audit-action.enum.ts`, `apps/api/src/modules/person/person.service.ts`, `apps/api/src/modules/person/person.controller.ts`
- Test: `apps/api/src/modules/person/person-hard-delete.integration.spec.ts`, `apps/api/src/modules/person/person.controller.spec.ts`

**Interfaces:**
- Consumes: `getParticipation` (Task 1).
- Produces: `PersonService.hardDelete(id: string): Promise<PersonParticipation>` (retorna el resum previ, per a l'auditoria); `DELETE /persons/:id/permanent` → 204, `@Roles(UserRole.ADMIN)`.

- [ ] **Step 1: Tests que fallen:** integració — persona amb assistència, assignació, delegat, etiqueta, mentee i compte → després de `hardDelete` no existeix cap d'eixes files, el mentee té `mentorId NULL`, el `User` existeix amb `person_id NULL`. Controller — crida `auditService.record({ action: PERSON_DELETED, targetType: 'Person', targetId: id, metadata: { name, alias, legacyId, participation } })` i el mètode té `@Roles(ADMIN)`.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** Implementa dins `this.dataSource.transaction(async (manager) => …)` (patró `person-delegate.service.ts:115`), en l'ordre: delete `node_assignments`, delete `attendances`, update `persons.mentorId`, update `users.person_id`, delete `persons`. Captura `QueryFailedError` amb codi `23503` → `ConflictException('No es pot eliminar la persona: encara té dades vinculades.')`.
- [ ] **Step 4:** → PASS; `nx test api` verd.
- [ ] **Step 5: Commit** `feat(api): admin-only permanent person delete`

---

### Task 3: Modal d'eliminació al dashboard

**Files:**
- Create: `apps/dashboard/src/app/features/persons/components/person-delete-modal/person-delete-modal.component.{ts,html,spec.ts}`
- Modify: `apps/dashboard/src/app/features/persons/services/person.service.ts` (`getParticipation(id)`, `deletePermanently(id)`), `apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.{ts,html}`

**Interfaces:**
- Consumes: Task 1 i 2.
- Produces (el pla 3 en depén): `<app-person-delete-modal [person]="Pick<Person,'id'|'name'|'firstSurname'|'alias'>" (deleted)="…" (closed)="…" />`. Carrega la participació en obrir; emet `deleted` amb l'`id` després del 204.

Contingut:
- Títol «Eliminar <àlies o nom>».
- Llista de participació: «N assistències (X assajos i Y actuacions amb assistència confirmada)», «N posicions en pinyes en M esdeveniments», «N delegacions», «És mentor de N persones», «Compte d'usuari: <email> — quedarà sense persona vinculada».
- `lib-alert variant="warning"`: «Esta acció no es pot desfer. S'eliminaran també les assistències i les posicions en pinyes.» + si `legacyId`: «Si sincronitzeu amb l'app antiga, la persona tornarà a aparéixer sense historial.»
- `lib-input` «Escriviu <àlies> per a confirmar»; `lib-button variant="error"` «Elimina definitivament», desactivat fins que coincidix (sense distingir majúscules ni espais als extrems).
- A la fitxa: botó al final («Zona perillosa»), només si `authService.isAdmin()`; en `deleted` → toast «S'ha eliminat la persona.» i `router.navigate(['/persons'])`.

- [ ] **Step 1: Tests que fallen:** el botó és desactivat fins escriure l'àlies; en confirmar fa `DELETE /api/persons/p1/permanent` i emet `deleted('p1')`; amb `legacyId` es veu l'avís de sincronització; a la fitxa el botó no apareix per a TECHNICAL.
- [ ] **Step 2:** → FAIL.
- [ ] **Step 3:** Implementa.
- [ ] **Step 4:** → PASS; `nx lint dashboard`.
- [ ] **Step 5:** Manual `03-persones.md` + `pnpm run docs:manual-shots`.
- [ ] **Step 6: Commit** `feat(dashboard): permanent person delete with participation summary`
