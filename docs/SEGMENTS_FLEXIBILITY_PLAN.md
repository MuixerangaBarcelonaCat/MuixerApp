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
_(a omplir en executar la fase: escenari / esperat / obtingut / PASS-FAIL)_

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
_(a omplir)_

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
_(a omplir)_

---

## Fase 3 — El taller en mode lectura (visual, sense mutació nova)

**Objectiu (spec):** amb dades de producció (0 conflictes) la UI és idèntica a l'actual excepte
comptadors nous de dotació; amb dades sembrades a mà, l'estil de conflicte es veu arreu (canvas,
tronc-view, projecció) però no hi ha manera d'actuar-hi encara.

### Passos
1. Models del dashboard amb placements plurals, àrea, conflictes.
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
_(a omplir)_

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
