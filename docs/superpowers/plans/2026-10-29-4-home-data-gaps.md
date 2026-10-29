# Inici: dades pendents de les persones — Pla d'implementació

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La pantalla d'Inici del dashboard mostra una targeta «Dades pendents» amb recomptes del que falta a les persones (noves, provisionals, sense etiquetes, gènere, alçada, data de naixement, telèfon, compte, camises per entregar); cada fila porta a la llista de persones ja filtrada.

**Architecture:** Backend: `GET /persons/data-gaps` fa una sola consulta amb `COUNT(*) FILTER (WHERE …)` i reutilitza `findShirtCandidates` + `shirtProgress` per a les camises. La llista de persones aprén a llegir els filtres de la URL (query params) i el filtre nou `createdAfter`. Frontend: un component `app-data-gaps-card` a `features/home`.

**Tech Stack:** NestJS 11, TypeORM, Jest + testcontainers; Angular 21 (standalone, OnPush, Signals, `rxResource`, `ActivatedRoute`), `@muixer/ui` (`lib-card`, `lib-badge`, `lib-empty-state`), Vitest.

**Spec:** cap document separat; decisions a §Decisions.

**Depén de:** pla 3 Task 1 (`PERSON_MISSING_FIELDS`, filtre `missing`).

## Decisions

- Univers: persones **actives i no provisionals**, excepte la fila «Provisionals» (actives i provisionals). Les files amb recompte 0 no es mostren; si totes són 0, la targeta mostra «Les fitxes de les persones estan completes.».
- Files, en este ordre (etiqueta · condició · enllaç):
  1. «Persones noves (últims 30 dies)» · `createdAt >= now() - 30 dies` · `/persons?createdAfter=<YYYY-MM-DD>`
  2. «Provisionals per revisar» · `isProvisional` · `/persons?isProvisional=true`
  3. «Falten etiquetes» · regla mínima d'etiquetes (la mateixa SQL que `tagRuleOk=false`, `utils/tag-rule-filter.util.ts`) · `/persons?tagRuleOk=false`
  4. «Sense gènere» · `missing=gender`
  5. «Sense alçada d'espatlles» · `missing=shoulderHeight`
  6. «Sense data de naixement» · `missing=birthDate`
  7. «Sense telèfon» · `missing=phone`
  8. «Sense compte a l'app» · `missing=account`
  9. «Camises per entregar» · candidats `eligible` segons `shirtProgress` · `/persons/camises`
- `NEW_PERSON_DAYS = 30`, constant al servei (no és configuració de la colla).
- Propostes que **no** entren (per decidir després): persones en acollida (`onboardingStatus = IN_PROGRESS`), sense assistència en N mesos, xicalla sense mentor, comptes amb push desactivat.

## Global Constraints

- UI en valencià (`.agents/skills/language-rules/SKILL.md`). Standalone + OnPush + Signals; `@muixer/ui` i tokens; icones de `DOMAIN_ICONS`/Lucide.
- `GET /persons/data-gaps` declarat abans de `GET /persons/:id`; `@Roles` de classe (TECHNICAL/ADMIN).
- `createdAfter`: `@IsDateString()` opcional a `PersonFilterDto`.
- La llista de persones: els query params només inicialitzen `activeFilters` en entrar; no cal sincronitzar la URL quan l'usuari canvia filtres després (`ponytail:` afegir-ho si es volen enllaços compartibles des de la llista).
- Sense `Co-Authored-By`.
- Manual: `docs/manual/01-primers-passos.md` secció «Llegir «Inici»» (`:57-66`) i captura `img/01-inici.png`; `pnpm run docs:manual-shots`.

## Review Focus

- Entrar a `/persons?missing=gender` amb una sessió que té filtres per defecte (`isProvisional: false`): s'apliquen tots dos i el xip «Sense gènere» apareix a `app-active-filters` i es pot treure.
- Query param invàlid (`/persons?missing=xyz`): s'ignora en el client, la llista carrega sense error.
- Colla sense cap persona: la targeta mostra el missatge de «completes», no un error.
- Fallada de `data-gaps`: la resta de l'Inici (pròxim assaig/actuació) es mostra igual; la targeta mostra un `lib-alert` curt.
- Persona provisional sense gènere: compta a «Provisionals», no a «Sense gènere».

---

### Task 1: Filtre `createdAfter` + endpoint `data-gaps`

**Files:**
- Create: `libs/shared/src/interfaces/person-data-gaps.interfaces.ts` (+ export)
- Modify: `apps/api/src/modules/person/dto/person-filter.dto.ts`, `apps/api/src/modules/person/person.service.ts`, `apps/api/src/modules/person/person.controller.ts`
- Test: `apps/api/src/modules/person/person-data-gaps.integration.spec.ts`

**Interfaces:**
- Produces:
  ```ts
  interface PersonDataGaps {
    newPersons: number; newSince: string; // YYYY-MM-DD
    provisional: number; missingTags: number;
    missingGender: number; missingShoulderHeight: number; missingBirthDate: number;
    missingPhone: number; withoutAccount: number; shirtsToAward: number;
  }
  ```
  - `PersonService.getDataGaps(): Promise<PersonDataGaps>`; `GET /persons/data-gaps`.
  - `PersonFilterDto.createdAfter?: string` → `person.createdAt >= :createdAfter`.
  - Les condicions de `missing` es reutilitzen del mapa del pla 3 Task 1 (exporta'l des del servei/util on visca, no el dupliques).

- [ ] **Step 1: Test que falla:** fixture amb una persona per cas (nova, provisional sense gènere, sense etiquetes, sense alçada, sense data, sense telèfon, amb compte, inactiva sense res, elegible per camisa) → cada comptador val l'esperat; la inactiva no compta enlloc; la provisional sense gènere només compta a `provisional`. `GET /persons?createdAfter=<data>` només retorna les creades després.
- [ ] **Step 2:** `nx run api:test-integration --testFile=…person-data-gaps.integration.spec.ts` → FAIL.
- [ ] **Step 3:** Implementa (una consulta `COUNT FILTER` per a 1–8; `findShirtCandidates()` filtrat per `shirtProgress(...).eligible` per a 9).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(api): persons data-gaps summary and createdAfter filter`

---

### Task 2: La llista de persones llig filtres de la URL

**Files:**
- Modify: `apps/dashboard/src/app/features/persons/components/person-list.component.{ts,spec.ts}` (`activeFilters` a `:121`, xips a `:398`), `apps/dashboard/src/app/features/persons/services/person.service.ts` (passa `missing[]` i `createdAfter`), model de filtres de persones

**Interfaces:**
- Produces: `parsePersonListQuery(params: ParamMap): Partial<PersonFilters>` (funció pura exportada des del component) que entén `missing` (múltiple, validat contra `PERSON_MISSING_FIELDS`), `tagRuleOk`, `isProvisional`, `createdAfter`. Xips: «Sense gènere», «Sense alçada d'espatlles», «Sense data de naixement», «Sense telèfon», «Sense compte», «Alta des del dd/MM/yyyy».

- [ ] **Step 1: Tests que fallen:** `parsePersonListQuery` amb `missing=gender&missing=xyz&tagRuleOk=false` → `{ missing:['gender'], tagRuleOk:false }`; el component amb eixos params fa la petició `GET /api/persons?...missing=gender&tagRuleOk=false...` i pinta el xip; treure el xip refà la petició sense el filtre.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS.
- [ ] **Step 5: Commit** `feat(dashboard): persons list reads filters from query params`

---

### Task 3: Targeta «Dades pendents» a l'Inici

**Files:**
- Create: `apps/dashboard/src/app/features/home/components/data-gaps-card/data-gaps-card.component.{ts,html,spec.ts}`
- Modify: `apps/dashboard/src/app/features/home/home.component.{ts,html}` (targeta a amplada completa sota les dues d'esdeveniments, abans de la de sincronització), servei de persones del dashboard (`getDataGaps()`), `docs/manual/01-primers-passos.md`

**Interfaces:**
- Consumes: `GET /persons/data-gaps` (Task 1), query params (Task 2).
- Produces: `<app-data-gaps-card />` (sense inputs; carrega amb `rxResource`).

Detalls: `lib-card sash="title"` títol «Dades pendents». Cada fila és un `routerLink` amb `queryParams`: etiqueta a l'esquerra, `lib-badge` amb el recompte a la dreta. Definició de files com a array estàtic `{ key: keyof PersonDataGaps; label; link; queryParams? }` en l'ordre de §Decisions.

- [ ] **Step 1: Tests que fallen:** amb `{missingGender: 3, ...0}` només es pinta «Sense gènere» amb `3` i enllaç `/persons?missing=gender`; tot a 0 → missatge «Les fitxes de les persones estan completes.»; error HTTP → `lib-alert` i la resta de l'Inici es pinta.
- [ ] **Step 2:** → FAIL. **Step 3:** implementa. **Step 4:** → PASS; `nx lint dashboard`; `pnpm run ci:local`.
- [ ] **Step 5:** Manual `01-primers-passos.md` + `pnpm run docs:manual-shots` (difumina dades personals, l'àlies no ho és).
- [ ] **Step 6: Commit** `feat(dashboard): data gaps card on home`
