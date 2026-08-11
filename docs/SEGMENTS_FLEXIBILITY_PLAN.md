---
tags: [domini]
---

# Flexibilitat de segments — pla d'execució i verificació

> Complementa [[SEGMENTS_FLEXIBILITY]] (el disseny, D1–D13, taxonomia, riscos). Aquest document és
> **operatiu**: com s'executa cada fase i com es demostra, amb proves reals, que fa el que diu que fa
> abans de passar a la següent.

## Com s'utilitza aquest document

1. **Una sessió nova per fase**, en mode Plan. Al començar la sessió: llegir [[SEGMENTS_FLEXIBILITY]] §7
   (la fase corresponent) + la secció d'ací baix per a la mateixa fase. El pla que es proposi en mode
   Plan ha de derivar-se d'aquestes dues fonts, no reinventar-se.
2. Implementar seguint els passos.
3. **Executar el protocol de verificació d'aquesta fase** — literalment, amb comandes reals contra l'API
   de dev, tests d'integració/unitaris, i **Playwright per a tot escenari "Comportamental"/visual**
   (veure "Eina de proves visuals" ací baix). No es fa servir com a substitut de `nx test`; és a més,
   perquè el "Fet quan" de l'spec és sobre comportament observable, no només tests verds.
4. **Si per completar un escenari fa falta alguna cosa que no existeix** (una dada concreta, un
   segment, una figura, una pinya, un usuari, credencials, o qualsevol setup que no es pugui crear de
   forma segura des del propi test) — **aturar l'execució d'eixe escenari i preguntar-ho a l'usuari
   directament**, en lloc de improvisar-ho, deixar-lo a mitges o donar-lo per fet. Preguntar
   explícitament què falta i si ho crea l'usuari o si Claude ho pot crear (via API/fixture de
   Playwright) amb el seu vist-i-plau.
5. Omplir la secció **Resultats — Fase N** d'ací baix (escenari → esperat → obtingut → PASS/FAIL) i
   donar un resum a l'usuari abans de tancar la sessió.
6. Si algun escenari falla: no passar de fase. Arreglar o documentar per què es descarta.

**Per què una sessió per fase, i no una de contínua:** l'spec ja divideix el treball en 8 fases
precisament per aïllar risc (Fase 2 toca una feature en producció; Fase 4 introdueix mutació/undo nous;
Fase 5 és l'única que canvia comportament). Una sessió per fase manté el context centrat en un sol tipus
de risc i evita que errors d'una fase s'arrosseguin silenciosament a la següent per fatiga de context.
L'estat compartit entre sessions són els dos documents (spec + aquest), no la memòria de la conversa.

---

## Seguiment del sprint

Estat de conjunt, actualitzat en tancar cada fase (no cal obrir cada secció per saber on som).

| Fase | Objectiu | Estat | Data | Resultats |
|---|---|---|---|---|
| 0 | Fonaments i bugs de col·lapse | ✅ Fet | 2026-08-10 | [§Resultats Fase 0](#resultats--fase-0) |
| 1 | Motor de conflictes (backend additiu) | ✅ Fet | 2026-08-10 | [§Resultats Fase 1](#resultats--fase-1) |
| 2 | Participació sobre la font canònica | ✅ Fet | 2026-08-10 | [§Resultats Fase 2](#resultats--fase-2) |
| 3 | El taller en mode lectura | ✅ Fet | 2026-08-11 | [§Resultats Fase 3](#resultats--fase-3) |
| 4 | Resolució interactiva al taller | ⬜ Pendent | — | — |
| 5 | El canvi de règim (release coordinada) | ⬜ Pendent | — | — |
| 6 | Equilibri de participació event-wide | ⬜ Pendent | — | — |
| 7 | Seguiments (specs separats, fora del sprint principal) | ⬜ Sense planificar | — | — |

**Notes de la Fase 0:** implementada seguint TDD estricte (RED→GREEN als llocs amb comportament
provable). 858/858 tests API, 1496/1498 dashboard (2 skips preexistents), 29/29 shared; 0 errors de
lint; migració verificada up/down contra la BBDD real de dev. Playwright del cas reproduïble §1.1
**omès a propòsit** (decisió explícita de l'usuari): la resposta del modal de moure ja queda provada
byte-idèntica a nivell unitari, i la Fase 0 no canvia comportament observable.

---

## Eina de proves visuals: Playwright

Tot escenari marcat com **"Comportamental"** en el protocol de cada fase (canvas, tronc-view,
segment-manager, taller, modals, banner de conflictes, panell de persones, Participació) s'implementa i
s'executa com a **test Playwright**, no com a inspecció manual o screenshot solt:

- Ubicació: `apps/dashboard-e2e` (o el paquet e2e corresponent — veure [docs/AUDIT_SUITE.md](AUDIT_SUITE.md)
  per a l'estructura existent). Cada escenari d'una fase és, com a mínim, un test Playwright que
  navega, interactua (clic, drag, formularis) i asserta sobre el DOM/estat resultant — no només sobre
  captures visuals.
- Quan l'escenari demana "comparar abans/després" (regressió visual), Playwright fa la captura amb
  `page.screenshot()` als dos moments i la comparació es reporta a l'usuari (no cal snapshot-testing
  automatitzat si no existeix ja al projecte — la comparació la fa Claude a ull i ho diu explícitament
  al resum).
- Els tests d'aquesta implementació viuen junts sota un directori clarament identificat (p. ex.
  `apps/dashboard-e2e/segments-flexibility/fase-N.spec.ts`) perquè es puguin re-executar quan calgui
  sense buscar-los entre la resta de l'audit suite.
- Playwright corre contra `nx serve dashboard` (i `nx serve api`) ja alçats — no cal mock de backend:
  l'objectiu és veure el comportament real end-to-end.

**Si un test Playwright necessita dades que no existeixen** (un segment nou, una figura amb prou nodes,
persones assignades en un estat concret, una pinya muntada de cert tipus) — no s'improvisa ni es
crea silenciosament a través d'un atajo (SQL directe, fixture ad-hoc sense avisar). Es segueix la regla
del punt 4 de dalt: **es pausa i es pregunta a l'usuari** què cal i qui ho crea. Si l'usuari dona el
vist-i-plau perquè Claude ho creï (per exemple, via l'API o des del mateix test amb un pas de setup
previ dins de Playwright), es documenta al resum de resultats quines dades es van crear i com, perquè
es puguin reproduir o netejar després.

---

## Entorn de verificació (comú a totes les fases)

- API dev: `nx serve api` (`http://localhost:3000/api`, Swagger a `/api/docs`).
- Dashboard dev: `nx serve dashboard` (`http://localhost:4200`) quan la fase toca UI — Playwright hi
  apunta directament (veure secció anterior).
- BBDD amb dades reals de dev disponible (169 assignacions / 86 persones, segons l'spec §4.1) per a
  proves de volum/rendiment; per a proves de conflictes calen **dades sembrades a mà** fins la Fase 5
  (les constraints encara bloquegen duplicats reals).
- **Cas reproduïble de referència** (spec §1.1): event `29b88c09-a57c-4de6-9ce8-894b91610a99`, segments
  `Pinets` (sortOrder 0) i el segment amb *Remat de Xopera + Piló* (sortOrder 1). Si algun escenari
  necessita un event/segment/figura equivalent que ja no existeixi en dades reals, aplicar la regla de
  pausa i pregunta abans de crear-ne un altre pel seu compte.
- Autenticació per a proves via `curl`: `POST /api/auth/login` amb un usuari `TECHNICAL`/`ADMIN` de dev →
  token a l'`Authorization: Bearer` de les crides següents (15 min de vida; repetir login si expira).
- Quan una fase requereix duplicats "reals" abans de la Fase 5 (per provar classificació de conflictes),
  sembrar-los **directament a BBDD** (`pnpm run docker:psql` o un `INSERT` puntual a `node_assignments`)
  saltant-se temporalment la unique constraint amb `ALTER TABLE ... DISABLE TRIGGER` no cal — n'hi ha
  prou amb inserir files a mà mentre no violin les 3 uniques (p. ex. dues persones diferents al mateix
  node no val; cal la mateixa persona a dos nodes diferents del mateix segment, que **avui la unique
  `UQ_node_assignments_segment_person` impedeix** — per tant, per a Fases 0–4 cal sembrar a nivell de
  test (unitari/integració amb constraint dropada dins la transacció, com ja fa
  `event-participation.integration.spec.ts:303`) i no via l'API real.

---

## Fase 0 — Fonaments i bugs de col·lapse

**Objectiu (spec):** cap canvi de comportament visible; el codi passa a poder manejar *n* files per
persona.

### Passos
1. `libs/shared`: `AssignmentArea`, `areaForZone()`, `SegmentConflictKind`, `KEEP_BOTH` a l'enum de
   resolució. Exportar-los a `libs/shared/src/index.ts`.
2. `node-assignment.service.ts:590-617` `getSegmentMoveConflicts()` → retorna
   `SegmentMoveConflict { personId; placements[]; kind }` en lloc de col·lapsar per persona.
3. `available-persons.service.ts:177-193` → `assignedDetails` acumula en array, no `.set()`.
4. `pinyes-tab.component.ts:404-406` i `troncs-tab.component.ts:290-292` → `onAssignedPersonSelected`
   recull totes les coincidències, no `.find()`.
5. Migració additiva: índexs `(segmentId, personId)` i `(figureInstanceId, personId)`.
6. Substituir llistes de zones ad-hoc per `areaForZone()` només on el significat és tronc/pinya
   conceptual (move conflicts, tronc-view, `targetTabForZone`) — **no** a les queries de completesa.

### Protocol de verificació
- **Unitaris:** `nx test api --testFile=libs/shared/.../area-for-zone.spec.ts` (nou, incloent el cas
  BASE) i els 5 tests reescrits de `node-assignment.service.spec.ts:679-767` amb el contracte plural.
- **Comportamental (sense duplicats encara, constraints intactes):**
  1. Amb l'API dev corrent, repetir el flux del cas reproduïble (moure el Piló de segment 2 a segment
     1 a l'event `29b88c09-...`) i confirmar via `curl -X GET /api/events/.../segments/.../conflicts`
     (si ja existent parcialment) o inspecció manual que el comportament de moviment **no ha canviat**:
     encara bloqueja igual que abans (Fase 0 no toca `move()`).
  2. `nx test dashboard --testFile=.../pinyes-tab.component.spec.ts` i l'equivalent de troncs: verificar
     que un mock amb 2 assignacions per la mateixa persona ja no en perd cap a `onAssignedPersonSelected`.
- **Regressió:** `nx test api` i `nx test dashboard` complets en verd; `nx lint api dashboard`.

### Resultats — Fase 0

| # | Escenari | Esperat | Obtingut | Resultat |
|---|----------|---------|----------|----------|
| 1 | `areaForZone()` per a totes les zones (inclòs BASE) | TRONC/BASE→TRONC, PINYA→PINYA, direccions→DIRECTION, DECORATION→null | Idèntic; test nou fixa la doble lectura de BASE (§5.3) | PASS |
| 2 | `getSegmentMoveConflicts()` no col·lapsa per persona | Retorna `{personId, placements[], kind}` amb placements tronc-primer i `kind` per §4.1 | 5 tests reescrits + nou cas TRONC_TRONC verds | PASS |
| 3 | `move()` manté la resposta HTTP | Body `{code, total, tronc}` idèntic (tronc = kind≠PINYA_PINYA) | Test assereix `total:3, tronc:2` igual que abans | PASS |
| 4 | `available-persons` no perd col·locacions | Amb 2 assignacions/persona, els camps singulars són deterministes (primera) | Test RED (retornava l'última) → GREEN | PASS |
| 5 | Tabs `onAssignedPersonSelected` `.find`→`.filter` | Cap regressió (avui 1 sola coincidència) | 96 tests dels dos tabs verds | PASS |
| 6 | Migració additiva up/down | 2 índexs nous conviuen amb les 3 uniques; `down()` neteja | Verificat a la BBDD real: 4→6→4 índexs | PASS |

**Resum:** Fase 0 completa sense cap canvi de comportament observable. Els tres col·lapses de
"primera coincidència" (§2) queden plural-capable; el més crític (`getSegmentMoveConflicts`) i el
d'`available-persons` estan coberts amb tests RED→GREEN reals. La resposta del modal de moure és
byte-idèntica (verificat a nivell unitari end-to-end: derivació al backend + el dashboard llegeix
només `{total, tronc}`).

**Tests automàtics:** `nx test shared` 29/29 · `nx test api` 858/858 · `nx test dashboard` 1496/1498
(2 skipped preexistents) — tots verds. `nx lint api|dashboard|shared` 0 errors. `nx build api` OK.
Reescrits: `node-assignment.service.spec.ts` (getSegmentMoveConflicts, +cas TRONC_TRONC),
`figure-instance.service.spec.ts` (mocks del nou contracte), nou
`assignment-area.constants.spec.ts`, nou cas a `available-persons.service.spec.ts`.

**Tests Playwright:** _pendent_ — la verificació comportamental del cas reproduïble §1.1 (modal de
moure amb total/tronc idèntics) necessita el stack `nx serve api`+`dashboard` alçat i l'event
`29b88c09-…` a la BBDD de dev. No s'ha executat en aquesta sessió (veure "Pendent").

**Dades/setup creats durant pauses de verificació:** cap. La migració es va provar aplicant/desfent
l'SQL a la BBDD real via `docker:psql` i deixant-la en l'estat pre-migració (TypeORM l'aplicarà al
següent `nx serve api`); no s'ha inserit cap fila ni tocat `typeorm_migrations`.

**Pendent/riscos oberts en tancar la fase:**
- Playwright behavioral (§1.1) **omès a propòsit** — decisió de l'usuari: en ser Fase 0 sense canvi
  de comportament i amb la resposta del modal ja provada byte-idèntica a nivell unitari, no s'hi
  afegeix cobertura e2e. Es reprendrà quan una fase posterior canviï comportament observable.
- El CLI `nx run api:migration-run` no carrega `.env` en aquesta shell (`injected env (0)`), quirk
  d'entorn independent d'aquest canvi; la migració s'aplica igualment al boot de l'API en dev.

---

## Fase 1 — Motor de conflictes (backend additiu, només lectura)

**Objectiu (spec):** `getSegmentConflicts()` com a font canònica; nous camps a Swagger; en producció
valen `0`/`[]`; cap resposta existent canvia de forma.

### Passos
1. `getSegmentConflicts(segmentId)` amb la query `GROUP BY personId HAVING COUNT(*) > 1` +
   classificació (`kind`, `suggestedRemovalAssignmentIds`, regla de precedència del cas mixt §4.1).
2. Endpoint `GET events/:eventId/segments/:segmentId/conflicts` → `SegmentConflictsResponse`.
3. Camps nous a `event-segment.service.ts` `findAllByEvent()`, `node-assignment.service.ts`
   `getEventAssignmentSummary()`, `projection.service.ts` `ProjectionData`.
4. `available-persons.service.ts`: `assignedPlacements[]`, `assignedInTronc/InPinya`,
   `conflictInSegment` (sempre `false` de moment).

### Protocol de verificació
- **Unitaris:** classificació dels 3 tipus + cas mixt de precedència + cas negatiu entre segments.
- **Integració** (patró `event-participation.integration.spec.ts:303`): dropar
  `UQ_node_assignments_segment_person` dins la transacció de test, inserir un duplicat real
  TRONC+PINYA per a la mateixa persona/segment, cridar `getSegmentConflicts()` i comprovar:
  - `kind === 'TRONC_PINYA'`,
  - `suggestedRemovalAssignmentIds` conté només la col·locació de pinya,
  - les `placements` venen ordenades tronc-primer.
  Repetir per TRONC_TRONC (2 troncs), PINYA_PINYA (2 pinyes) i el cas mixt (2 troncs + 1 pinya → ha de
  reportar-se com `TRONC_TRONC` amb la pinya igualment dins `suggestedRemovalAssignmentIds`).
- **Contracte a producció (dades reals, sense duplicats):**
  1. `curl -X GET http://localhost:3000/api/events/{id}/segments/{segmentId}/conflicts -H "Authorization: Bearer $TOKEN"`
     → `{ data: [], meta: { ... tots 0 ... } }`.
  2. Comparar la resposta de `findAllByEvent()` i `getEventAssignmentSummary()` abans/després del canvi
     amb el mateix event real: cap camp existent ha canviat de forma o de valor (només camps nous
     afegits).
  3. Obrir `/api/docs` i confirmar que els nous camps apareixen documentats a l'schema.

### Resultats — Fase 1

| # | Escenari | Esperat | Obtingut | Resultat |
|---|----------|---------|----------|----------|
| 1 | `getSegmentConflicts()` classifica TRONC_PINYA/TRONC_TRONC/PINYA_PINYA | `kind` per §4.1, `suggestedRemovalAssignmentIds` mai amb tronc, PINYA_PINYA manté la interior | Unitaris + integració (constraints dropades) verds | PASS |
| 2 | Cas mixt de precedència (2 tronc + 1 pinya) | `TRONC_TRONC` amb la pinya dins `suggestedRemovalAssignmentIds` | Unitari + integració amb duplicat real | PASS |
| 3 | Cas negatiu entre segments | Mateixa persona a 2 segments ≠ conflicte (query sempre scoped per `segmentId`) | Unitari + integració (2 segments reals) | PASS |
| 4 | Endpoint `GET events/:eventId/segments/:segmentId/conflicts` | Retorna `SegmentConflictsResponse` sense embolicar en `{ data }` (ja té `data`+`meta`) | Test de controller verd; reutilitza `@Roles`/`@ApiBearerAuth` de classe | PASS |
| 5 | Camps additius a `findAllByEvent`/`getEventAssignmentSummary`/`ProjectionData`/`available-persons` | En producció (sense duplicats) sempre `0`/`[]`; cap camp existent canvia de forma | Tests unitaris amb fixtures sense conflicte assereixen els defaults; regressió completa verda | PASS |
| 6 | D13 — font única, sense N+1 nou | `getEventAssignmentSummary`/`findAllByEvent` reusen les assignacions ja batched (`classifySegmentConflicts` extret) enlloc de cridar `getSegmentConflicts` per segment | Test explícit `assignmentRepo.find` cridat 1 sola vegada per tot l'event | PASS |
| 7 | Contracte a producció, dades reals (event `29b88c09-a57c-4de6-9ce8-894b91610a99`, segment "Pinets", sense duplicats) | `GET .../conflicts` → `{ data: [], meta: {..., conflictPersonCount: 0, ...} }`; `meta` idèntic al `conflicts` de `findAllByEvent()` pel mateix segment; `/assignment-summary` amb `conflictAssignmentCount: 0` a totes les figures; `ProjectionData.conflicts: []`; endpoint documentat a `/api/docs` | Els 4 punts verificats en viu amb `nx serve`-equivalent + login ADMIN real — `meta` byte-idèntic entre `/conflicts` i `findAllByEvent()` (assignmentCount 55, distinctPersonCount 55, tronc 8, pinya 43); `/assignment-summary` sense cap valor alterat, només camps nous; `/api/docs-json` conté `GET /api/events/{eventId}/segments/{segmentId}/conflicts` amb `security: [{bearer:[]}]` | PASS |

**Resum:** Fase 1 completa i additiva: `getSegmentConflicts()` és ara l'única implementació de
classificació de conflictes (D13), reutilitzada per l'endpoint nou i pels 4 llocs de lectura
existents sense re-implementar la lògica ni afegir cap query nova a `getEventAssignmentSummary`
(risc de N+1 evitat explícitament, amb test que ho fixa). En producció (constraints intactes) tots
els camps nous surten a `0`/`[]` i cap resposta existent canvia de forma — verificat afegint asserts
de forma a fixtures existents (`event-segment.controller.spec.ts`).

**Tests automàtics:** `nx test shared` 29/29 · `nx test api` 876/876 (inclou 6 tests nous
d'integració amb Postgres real a `segment-conflicts.integration.spec.ts`) · `nx test dashboard`
1496/1498 (2 skipped preexistents) — tots verds. `nx lint api|shared` 0 errors. `nx build api` i
`nx build dashboard` OK.

**Pendent/riscos oberts en tancar la fase:**
- **Quirk d'entorn (no introduït per aquest canvi):** `localhost:5433` en aquesta màquina de dev està
  ocupat per un procés SSH (`ssh` amb bind explícit a `127.0.0.1:5433`/`[::1]:5433`), que guanya per
  especificitat al bind `*:5433` de Docker Desktop. Per això `DATABASE_URL=...@localhost:5433/...`
  connecta al túnel SSH en lloc del Postgres de dev real, i `nx serve api` fallava amb "password
  authentication failed" tot i que les credencials de `.env` són correctes (verificat: el mateix
  password funciona connectant per `docker exec` i per la IP de LAN de la màquina). La verificació
  manual d'aquesta secció s'ha fet alçant l'API compilada (`node dist/apps/api/main.js`) amb
  `DATABASE_URL` apuntant a la IP de LAN en lloc de `localhost`, sense tocar `.env` ni el túnel SSH.
  Si aquest túnel no és intencionat, revisar-lo; si ho és, `nx serve api` normal seguirà fallant
  fins que `.env` apunti a una adreça que no col·lideixi amb `127.0.0.1`.
- Sense Playwright (fase backend-only, sense canvi observable) — mateix criteri que la Fase 0.
- **`assignedNodeCordon` (`available-persons.service.ts`) inconsistència de tipus preexistent, NO
  resolta en aquesta fase:** el servei ja retornava `assignedNodeCordon: detail?.renglaPosition ?? null`
  abans de la Fase 1, però aquest camp mai s'ha declarat a la interfície compartida `AvailablePerson`
  (`libs/shared/.../assignment.interfaces.ts`). En afegir els camps plurals d'aquesta fase
  (`assignedPlacements[]` etc.) **no s'ha duplicat** l'error — `cordon` sí és un camp declarat a
  `ConflictPlacement` — però el forat original al singular segueix obert. Abordar-ho quan es
  retirin els camps singulars (Fase 7): declarar `assignedNodeCordon` a `AvailablePerson` o eliminar-lo
  directament si `assignedPlacements[0]?.cordon` ja el substitueix.
- **Duplicació d'interfícies `EventFigureSummary`/`EventSegmentSummary`/`EventAssignmentSummary`,
  descoberta en implementar aquesta fase:** existeixen declarades **dues vegades** amb el mateix nom —
  a `libs/shared/src/interfaces/pinyes/assignment.interfaces.ts` (l'oficial, compartida amb el
  frontend) i, sencera i independent, dins `node-assignment.service.ts` (~línia 177). El servei fa
  servir la seua còpia local, no la de `shared`; he hagut d'afegir `distinctPersonCount`,
  `conflictAssignmentCount` i `conflicts` **a totes dues** perquè queden sincronitzades, però no hi ha
  cap mecanisme que ho garanteixi si algú només toca una còpia en el futur. Val la pena unificar-les
  (que el servei importi el tipus de `shared` en lloc de redeclarar-lo) en una fase de neteja, no
  urgent per a la Fase 2.
- **Fidelitat parcial de `figureName` dins `classifySegmentConflicts()` quan es crida des de
  `getEventAssignmentSummary()`:** aquest mètode reutilitza `classifySegmentConflicts()` sobre
  assignacions carregades sense la relació `figureInstance.figureTemplate` (per no afegir una query
  nova, risc de N+1 evitat a propòsit), així que qualsevol `ConflictPlacement.figureName` derivat
  d'aquest camí cau al fallback `'Sense plantilla'` encara que la figura en tingui. Avui és inofensiu
  perquè `getEventAssignmentSummary()` només exposa comptadors (`distinctPersonCount`,
  `conflictAssignmentCount`), mai els `placements` en brut — però si una fase futura exposa
  `SegmentConflict[]`/`placements` des d'aquest camí caldrà o bé afegir la relació o bé no confiar en
  `figureName` ací.
- **Cordó (`cordon = renglaPosition`) pendent de confirmar contra `ringLevel`:** decisió presa a
  `ConflictPlacement`/`available-persons` seguint la convenció ja existent al codi, però sense
  confirmar formalment si `ringLevel` és el cordó "real" en algun cas. Si en una fase posterior es
  detecta que calia `ringLevel`, cal corregir-ho i fixar-ho amb un test (ja anotat com a risc obert
  quan es va dissenyar la superfície compartida d'aquesta fase).

---

## Fase 2 — Participació sobre la font canònica

**Objectiu (spec):** la pestanya Participació es comporta **exactament igual** que abans en dades
reals; substitueix internament el càlcul propi per `getSegmentConflicts()` (o manté el batch propi amb
test d'equivalència obligatori).

### Passos
1. `event-participation.service.ts`: substituir `placements[segmentId].length > 1` per
   `getSegmentConflicts()` (o test d'equivalència si es manté el batch).
2. Afegir `area` a `EventParticipationPlacement`; `conflictsByKind` i `troncPlacements` a `meta`;
   `troncPlacementCount` per persona.

### Protocol de verificació
- **Test d'equivalència** (obligatori, D13/risc 9): sobre el dataset real de dev, comparar fila a fila
  la sortida de l'algorisme antic vs. el nou/`getSegmentConflicts()`-basat per a **tots** els segments
  amb activitat — 0 divergències.
- **Regressió del test negatiu existent:** `event-participation.service.spec.ts:318` verd sense canvis.
- **Comportamental (dashboard):**
  1. Obrir la pestanya Participació d'un event real amb activitat prèvia a la sessió.
  2. Capturar (screenshot o JSON de la resposta) la matriu **abans** del canvi i **després**: mateixos
     números, mateixa forma, únicament camps nous visibles si s'exposen a la UI en fases posteriors.
  3. `curl` a l'endpoint de participació de l'event real, diff de la resposta JSON contra una còpia
     desada abans de tocar el servei (excloent els camps nous).

### Resultats — Fase 2

| # | Escenari | Esperat | Obtingut | Resultat |
|---|----------|---------|----------|----------|
| 1 | Àrea derivada per placement | Cada `EventParticipationPlacement` porta `area` (BASE→TRONC, D10) | Unitari amb PINYA/TRONC/BASE barrejats verd | PASS |
| 2 | `troncPlacementCount` per persona + `troncPlacements` a `meta` | Compta TRONC+BASE a través de tots els segments | Unitari verd (2 de 3 placements) | PASS |
| 3 | `conflictsByKind` classifica com `getSegmentConflicts` (D13) | Mateixa regla §4.1 via helper compartit `classifyPlacementKind` | Unitari verd (TRONC_PINYA + PINYA_PINYA) | PASS |
| 4 | **Test d'equivalència** (D13 / risc 9) | 0 divergències Participació ↔ `getSegmentConflicts` per segment (persones i `kind`), i a l'agregat `conflictsByKind` | Integració Postgres real amb duplicats dels 3 tipus + cas cross-segment → 2 tests verds | PASS |
| 5 | Cas negatiu entre segments intacte | `event-participation.service.spec.ts:318` verd sense canvis | Regressió verda | PASS |
| 6 | Camps additius, cap forma existent muta | Els tests de `meta` amb `toEqual` exacte només guanyen els camps nous | 2 asserts de `meta` actualitzats amb els camps additius | PASS |
| 7 | Neteja #2: API importa de `shared` | `EventFigureSummary`/`EventSegmentSummary`/`EventAssignmentSummary`/`FigureAreaCount` esborrats del servei i importats de `@muixer/shared` | `nx build api` OK (equivalència estructural); JSDoc útil portat a `shared` | PASS |

**Resum:** Fase 2 completa i additiva. La pestanya Participació manté el seu batch de 3 queries i ara
classifica els conflictes amb **exactament** la mateixa regla que el motor canònic — la precedència
§4.1 viu a `@muixer/shared` (`classifyPlacementKind`), cridada tant per `classifySegmentConflicts()`
com per Participació, així que el `kind` no pot divergir per construcció. Per damunt, un **test
d'equivalència d'integració** contra Postgres real prova que les dues canonades de dades independents
(matriu SQL crua vs query d'entitats) coincideixen segment a segment sobre persones en conflicte i el
seu tipus (risc 9 tancat). La duplicació d'interfícies #2 queda resolta al backend: el servei importa
els tres tipus de resum de `shared`; la tercera còpia (dashboard) es resol a la Fase 3.

**Tests automàtics:** `nx test shared` verd (inclou els casos nous de `classifyPlacementKind`) ·
`nx test api` verd · `nx run api:test-integration` 66/66 (11 suites, inclou el nou
`participation-conflicts-equivalence.integration.spec.ts` amb 2 tests) · `nx test dashboard` 1496/1498
(2 skip preexistents). `nx lint api|shared` 0 errors. `nx build api` i `nx build dashboard` OK.
Reescrits: 2 asserts de `meta` a `event-participation.service.spec.ts`; refactor no-op de
`classifySegmentConflicts()` per usar l'helper compartit.

**Tests Playwright:** cap. Fase backend + tipus sense canvi observable a la UI (els camps nous valen
`0`/buit en producció mentre les constraints segueixen) — mateix criteri explícit de les Fases 0/1.

**Dades/setup creats durant pauses de verificació:** cap. Els duplicats de l'equivalència es sembren
dins del propi test d'integració (testcontainers) amb les constraints dropades a la transacció; no es
toca cap BBDD de dev.

**Verificació comportamental en viu (curl abans/després):** no executada, mateix motiu que la Fase 1
(quirk del túnel SSH a `localhost:5433` que impedeix `nx serve api` contra la BBDD de dev sense
reconfigurar). La garantia "es comporta exactament igual" queda coberta pel test d'equivalència contra
Postgres real + el fet que cap resposta existent canvia de forma (només camps additius, asserts de
forma verds). Si es vol la confirmació en viu, cal alçar l'API compilada apuntant `DATABASE_URL` a una
adreça que no col·lideixi amb el túnel.

**Pendent/riscos oberts en tancar la fase:**
- **Tercera còpia (dashboard), per a la Fase 3:** `apps/dashboard/src/app/features/pinyes/models/assignment.model.ts`
  manté encara `EventFigureSummary`/`EventSegmentSummary`/`EventAssignmentSummary` **stale** (sense
  `distinctPersonCount`, `conflictAssignmentCount`, `conflicts`). La Fase 3 (punt 1) ja preveu
  reescriure aquest model amb placements plurals, àrea i conflictes: allà s'ha de sincronitzar o
  importar de `@muixer/shared` (veure nota afegida a §Fase 3).
- La resta del bloc d'interfícies locals del servei (`AssignmentDetail`, `InstanceNodeResponse`,
  `PersonAssignmentEntry`) **divergeix de debò** de `shared` (`climbIndicator`, `notes`/`notesEmoji`,
  `renglaPosition`) i s'ha deixat intacta a propòsit — unificar-la és un refactor separat, fora d'abast.

---

## Fase 3 — El taller en mode lectura (visual, sense mutació nova)

**Objectiu (spec):** amb dades de producció (0 conflictes) la UI és idèntica a l'actual excepte
comptadors nous de dotació; amb dades sembrades a mà, l'estil de conflicte es veu arreu (canvas,
tronc-view, projecció) però no hi ha manera d'actuar-hi encara.

### Passos
1. Models del dashboard amb placements plurals, àrea, conflictes. **Inclou la neteja pendent de la
   Fase 2 (#2):** `assignment.model.ts` encara té una còpia stale de
   `EventFigureSummary`/`EventSegmentSummary`/`EventAssignmentSummary` (sense `distinctPersonCount`,
   `conflictAssignmentCount`, `conflicts`); en reescriure el model, sincronitzar-la o importar-la de
   `@muixer/shared` perquè el dashboard deixi de divergir del backend.
2. Estil visual únic de conflicte a `figure-canvas` (tots els modes) i `tronc-view`.
3. Píndoles del `segment-manager`: `⚠ N conflictes` + dotació per àrea al tooltip.
4. `AlreadyAssignedDialog` multi-col·locació (informatiu, sense "Assignar igualment" encara).
5. `TroncChangeImpact` retornat per `assign`/`unassign`/`swap`/`move` sobre nodes TRONC/BASE (no
   consumit encara).

### Protocol de verificació
- **Unitaris:** estil per `kind`, píndoles, `TroncChangeImpact`.
- **Visual amb dades reals (regressió):** capturar screenshot del taller (canvas, tronc-view,
  segment-manager) d'un segment real **abans** i **després** del deploy d'aquesta fase — han de ser
  visualment idèntics excepte els nous comptadors de dotació al tooltip.
- **Visual amb dades sembrades a mà** (BBDD de dev, sembrat directe ignorant temporalment que l'API no
  ho permet — cal fer-ho via `INSERT` SQL directe a `docker:psql` sobre un segment de prova, no via
  l'API):
  1. Sembrar una persona amb 2 nodes TRONC → confirmar banner/estil TRONC_TRONC al canvas i tronc-view.
  2. Sembrar tronc+pinya → estil TRONC_PINYA, mateix aspecte visual que l'anterior (mateix color/icona,
     spec §4.1: "un conflicte és un conflicte").
  3. Sembrar 2 pinyes → estil PINYA_PINYA.
  4. Obrir `AlreadyAssignedDialog` seleccionant una persona ja assignada en cada cas → apareix la llista
     completa de col·locacions amb àrea, sense cap acció nova disponible.
  5. Fer un `assign`/`move` sobre un node de tronc via `curl` i confirmar que la resposta inclou
     `impact.freedPinyaNodeIds` coherent amb els nodes que han quedat buits.

### Resultats — Fase 3

| # | Escenari | Esperat | Obtingut | Resultat |
|---|----------|---------|----------|----------|
| 1 | `TroncChangeImpact` a `assign`/`swap` sobre node TRONC/BASE | Retorna `impact { newConflicts, freedPinyaNodeIds }`; PINYA no retorna `impact` | Unitaris RED→GREEN a `node-assignment.service.spec.ts` (4 casos); reutilitza `getSegmentConflicts` (D13) + helper `computeFreedPinyaNodeIds` | PASS |
| 2 | Contracte additiu backend | `impact` opcional; cap resposta existent muta de forma | 883/883 tests API verds; `assign`/`swap` mantenen `.id`/`.node`/`{a,b}` (tipus intersecció) | PASS |
| 3 | Neteja stale Fase 2 (models dashboard) | `EventFigureSummary`/`EventSegmentSummary`/`AvailablePerson`/`ProjectionSegmentData` sincronitzats amb els camps de conflicte | Camps afegits localment (convenció `participation.model.ts`); dashboard compila | PASS |
| 4 | Estil de conflicte únic (canvas 3 modes + tronc-view) | Mateix estil ambre per als 3 `kind` — cap `kind` arriba al render (només `Set<personId>`) | `figure-canvas` (assignment/segment-assignment/readonly) + `tronc-view` `[class.conflict]`; helper `isConflict`/`isConflictAssignment` amb tests | PASS |
| 5 | Font de conflicte al taller | `SegmentWorkspaceStateService.conflictPersonIds` derivat de l'endpoint `/conflicts` (Fase 1); buit en producció | 2 tests nous (buit sense conflictes; 1 entrada per persona); recarregat a `load`/`refresh`/`refreshInstance` | PASS |
| 6 | Píndoles `segment-manager` | `⚠ N conflictes` només si `conflictPersonCount>0` (ocult en producció) + tooltip dotació per àrea | 4 tests nous (`segmentConflictCount`, `segmentDotacioTooltip`); `@if(count)` oculta a 0 | PASS |
| 7 | `AlreadyAssignedDialog` multi-col·locació | Llista totes les col·locacions amb àrea + avís de tronc; **sense** "Assignar igualment" | Spec nou (4 tests) verd; alimentat per `AvailablePerson.assignedPlacements` des dels dos tabs | PASS |
| 8 | Projecció rep conflictes | `ProjectionViewComponent` deriva `conflictPersonIds` de `ProjectionData.conflicts` i el passa a canvas+tronc-view | Computed nou + bindings a la template | PASS |
| 9 | Regressió completa | Tots els suites verds, lint net, builds OK | shared 32/32 · api 883/883 · dashboard 1509/1511 (2 skip preexistents) · lint 0 errors · build api+dashboard OK | PASS |

**Resum:** Fase 3 completa, additiva i purament visual + backend additiu — cap camí de mutació/resolució
nou (això és la Fase 4). Amb dades de producció (0 conflictes, constraints intactes) la UI és idèntica
excepte els comptadors nous de dotació al tooltip. Punt clau de disseny: al render només arriba un
`Set<personId>` (mai el `kind`), així que **per construcció** tots els tipus de conflicte pinten igual
("un conflicte és un conflicte"). La neteja stale heretada de la Fase 2 (3a còpia dels tipus de resum al
dashboard) queda resolta.

**Desviació de l'spec (acordada amb l'usuari):** `TroncChangeImpact` s'afegeix només a `assign`/`swap`
(no a `unassign`/`move`), per no ampliar ara els contractes de `unassign` (204) i `move`; es completarà a
la Fase 5 on aquestes operacions ja canvien.

**Tests automàtics:** `nx test shared` 32/32 (inclou els casos existents) · `nx test api` 883/883 (2 tests
nous a `assign`, 2 a `swap`) · `nx test dashboard` 1509/1511 (2 skip preexistents; nous: 2
`segment-workspace-state`, 3 `tronc-view` `isConflict`, 4 `segment-manager` píndoles, 4
`already-assigned-dialog`). `nx lint api|dashboard|shared` 0 errors. `nx build api` i `nx build dashboard`
OK.

**Tests Playwright:** `apps/dashboard-e2e/src/segments-flexibility/fase-3.spec.ts` creat (regressió de
zero-conflicte: el taller no mostra cap estil de conflicte i la píndola porta el tooltip de dotació).
Typecheck OK; **no executat en viu aquesta sessió** — el `nx serve api` va entrar en bucle de reinici
ràpid (168 reinicis, mai va lligar el port 3000, sense error explícit al log; flakiness de l'stack de dev
ja vista a fases anteriors). La prova visual amb conflictes **reals sembrats** queda deferida a després de
la Fase 5 (decisió de l'usuari a l'inici de la sessió).

**Dades/setup creats durant pauses de verificació:** cap. No s'ha tocat la BBDD de dev ni cap constraint;
tots els conflictes de test se simulen amb mocks (Vitest) o al nivell de servei (Jest).

**Pendent/riscos oberts en tancar la fase:**
- Playwright de regressió zero-conflicte **escrit però no executat** (bucle de reinici de `nx serve api`).
  Reprendre quan l'stack arrenqui net i amb credencials `E2E_EMAIL`/`E2E_PASSWORD`.
- `TroncChangeImpact` a `unassign`/`move` → Fase 5 (desviació acordada).
- Estil de conflicte visible amb dades reals → verificació deferida a després de la Fase 5.
- Els `impact` d'`assign`/`swap` **no es consumeixen encara** al frontend (dashboard) — es cablejaran a la
  Fase 4 (llista de revisió). La resposta els emet i queden documentats a Swagger via `@ApiOperation`.

---

## Fase 4 — Resolució interactiva al taller

**Objectiu (spec):** amb dades sembrades a mà, els tres tipus de conflicte es veuen i es resolen d'un
toc, amb undo, i cap acció massiva crea duplicats silenciosos.

### Passos
1. Banner + panell de conflictes al `segment-workspace`, ordenats per `kind`; botó "Allibera la pinya"
   (una sola entrada d'undo) per a `TRONC_PINYA`.
2. Llista de revisió alimentada per `TroncChangeImpact` + toast persistent "N pinyes a revisar".
3. Panell de persones simètric: bucket "Al tronc d'este segment" (Pinyes) / "Ja a la pinya d'este
   segment" (Troncs).
4. Modal de moure redissenyat (3 opcions, `KEEP_BOTH` per defecte) **darrere del flux forçat actual**.
5. Tests dels comptadors deduplicats, ordenació per `kind`, bucket de tronc, entrades d'undo.

### Protocol de verificació
- **Unitaris/Vitest:** els llistats al punt 5 dels passos.
- **Comportamental amb dades sembrades:**
  1. Amb els 3 tipus de conflicte sembrats (reutilitzant el sembrat de Fase 3), obrir el
     `segment-workspace` → el banner mostra el recompte correcte i el panell ordena TRONC_TRONC i
     TRONC_PINYA abans que PINYA_PINYA.
  2. Clicar "Allibera la pinya" sobre un `TRONC_PINYA` → totes les col·locacions de pinya suggerides
     desapareixen; **un únic** `Ctrl+Z` les recupera totes (no calen N desfer).
  3. Provocar un canvi de tronc (assign/unassign sobre TRONC) → apareix el toast "N pinyes a revisar" i
     obre la llista amb els nodes de pinya buidats correctes.
  4. Al panell de persones, confirmar que una persona assignada al tronc del segment apareix al bucket
     "Al tronc d'este segment" a la pestanya Pinyes, i viceversa a Troncs.
  5. Provar el modal de moure amb un conflicte que involucra tronc: `KEEP_BOTH` ha de ser la primera
     opció i la marcada per defecte.
- **Comportamental amb dades de producció (regressió):** el flux normal d'assignar/moure sense cap
  duplicat existent es comporta exactament igual que abans (el flux forçat de moure encara és l'actual
  fins Fase 5).

### Resultats — Fase 4
_(a omplir)_

---

## Fase 5 — El canvi de règim (release coordinada)

**Objectiu (spec):** aquesta és l'única fase que canvia comportament real. Cal la major cura de
verificació — inclou el checklist de greps del spec abans de desplegar.

### Passos
1. Migració: eliminar `UQ_node_assignments_instance_person` i `UQ_node_assignments_segment_person`;
   down-migration que esborra duplicats (mantenint el més antic) abans de tornar-les a posar.
2. `assignWithoutLockCheck()`: treure els pre-checks de persona, retornar `conflicts`.
3. `swap()`: fer-lo retornar `conflicts`/`impact` com `assign()`; embolicar el `save()` en try/catch.
4. `move()`: `KEEP_BOTH` per defecte, sense 409; resposta amb conflictes creats + `impact`.
5. `bulkImport()`: importar i marcar duplicats com a conflicte (D5), reportant recompte per tipus.
6. Frontend: activar "Assignar igualment" (D8), treure toasts de 409 de persona, commutar modal de
   moure, canviar text del toast d'import.
7. **Checklist de greps abans de desplegar** (spec §Fase 5, literal): `assignedInstanceId`,
   `find(a => a.person`, `status === 409`, `SEGMENT_MOVE_CONFLICT`, `PERSON_IN_SEGMENT`,
   `PERSON_IN_INSTANCE`, i totes les crides a `swap(` (backend i dashboard).

### Protocol de verificació
- **Abans de tocar codi:** `pg_dump` explícit de `node_assignments` (risc 5 del spec) — pas obligatori,
  no opcional.
- **Migració:**
  1. Aplicar la migració en un entorn de dev amb dades reals → confirmar amb `\d node_assignments` a
     `docker:psql` que només queda `UQ_node_assignments_instance_node`.
  2. Provar la down-migration sobre una còpia amb duplicats sembrats a mà → confirmar que esborra els
     duplicats (mantenint el més antic) i que les 3 uniques tornen a existir sense error.
- **Comportamental — el mateix cas reproduïble del spec §1.1** (event `29b88c09-...`), ara amb l'API
  real:
  1. Assignar la mateixa persona dues vegades dins el mateix segment via UI o `curl` → **sense 409**,
     resposta amb `conflicts` poblats.
  2. Repetir el moviment del Piló entre segments amb el nou modal → `KEEP_BOTH` per defecte manté totes
     les assignacions als dos costats; confirmar amb `GET .../conflicts` que els duplicats esperats hi
     apareixen classificats.
  3. Provar `swap()` entre dues persones on una ja té un conflicte previ → no llança 500, retorna
     `conflicts` a la resposta.
  4. `bulkImport()` amb un fitxer que conté files duplicades intencionadament → s'importen totes, es
     reporta el recompte per tipus, i les files amb node ocupat o sense node equivalent encara se salten.
  5. Flux e2e complet: *assignar duplicat → banner → resoldre des del panell → desfer* (Playwright).
- **Regressió de tests reescrits:** `node-assignment.service.spec.ts:444-505`,
  `figure-instance.service.spec.ts:515-545`, `event-segment.controller.spec.ts:148-167` ja no esperen
  409 sinó `conflicts`.
- **Checklist de greps** executat i net (0 resultats fora dels llocs ja migrats intencionadament).

### Resultats — Fase 5
_(a omplir — aquesta fase necessita el resum més detallat, ja que és l'única amb canvi de comportament
real i sense marxa enrere barata)_

---

## Fase 6 — Equilibri de participació event-wide

**Objectiu (spec):** dades de càrrega per decidir reajustos amb criteri; no bloqueja ni depèn de la
Fase 5.

### Passos
1. Filtre d'àrea a Participació + matriu de troncs event-wide.
2. Columnes ordenables `placementCount`/`troncPlacementCount` + estadístiques de capçalera.
3. Ordre "menys carregades primer" al panell de persones del taller.
4. Avís informatiu opcional (D12) per segments amb hores solapades i persona compartida.

### Protocol de verificació
- **Unitaris:** mètriques de càrrega, filtre d'àrea.
- **Comportamental amb dades reals de dev:**
  1. Activar el filtre "Només troncs" a Participació → la matriu mostra només col·locacions TRONC/BASE
     per a totes les persones/segments de l'event.
  2. Ordenar per `troncPlacementCount` → l'ordre coincideix amb un recompte manual sobre 2-3 persones de
     control.
  3. Comprovar l'estadística de capçalera (mín/mitjana/màx, "persones sense cap col·locació") contra un
     càlcul manual sobre el mateix event.
  4. Si l'event de prova té segments amb hores solapades i persona compartida, confirmar que apareix
     l'avís informatiu i que no bloqueja cap acció.

### Resultats — Fase 6
_(a omplir)_

---

## Fase 7 — Seguiments

No forma part del desplegament principal; es documenta a l'spec com a specs separats (retirar camps
singulars, resolució massiva, log auditable, Mode POM, PWA). **Sense protocol de verificació propi
ací** — cada seguiment necessitarà el seu propi mini-pla quan es reprengui.

---

## Plantilla de "Resultats — Fase N"

Per copiar dins de cada secció en acabar la fase:

```markdown
### Resultats — Fase N

| # | Escenari | Esperat | Obtingut | Resultat |
|---|----------|---------|----------|----------|
| 1 | ... | ... | ... | PASS/FAIL |

**Resum:** (2-3 frases: què s'ha verificat, què ha fallat si escau, si es pot passar a la fase següent)
**Tests automàtics:** `nx test api` ..., `nx test dashboard` ... (verds/vermells, què s'ha reescrit)
**Tests Playwright:** fitxer(s) creat(s) a `apps/dashboard-e2e/segments-flexibility/...`, resultat de
cada un
**Dades/setup creats durant pauses de verificació:** (si n'hi ha hagut — què es va demanar, què va
respondre l'usuari, què es va crear i on, per poder reproduir-ho o netejar-ho)
**Pendent/riscos oberts en tancar la fase:** ...
```

---

*Veïns: [[SEGMENTS_FLEXIBILITY]] · [[PINYES_MODULE]] · [[DATA_MODEL]] · [[ROADMAP]]*
