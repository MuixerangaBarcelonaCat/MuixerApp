---
tags: [domini]
---

# Flexibilitat de segments — pla d'implementació

> **Estat: dissenyat, no implementat.** Cap línia d'aquest document està al codi.
> Verificat contra el codi i la BBDD local el **5 d'agost de 2026**.
>
> Objectiu: que una persona pugui estar assignada **dues vegades dins el mateix segment** mentre es
> prepara un event, amb un avís molt clar i classificat, en lloc que el sistema ho bloquegi o esborri
> assignacions pel seu compte.
>
> **No hi ha cap noció de subequip.** L'ordre de treball real (primer els troncs, després les pinyes)
> és el *context* que explica per què fa falta la flexibilitat i com s'han de classificar els avisos,
> però **qualsevol tècnic pot canviar qualsevol cosa** — troncs i pinyes — sense perfils, rols ni
> permisos nous. Es va valorar modelar-ho i s'ha descartat a propòsit: seria fricció contra la
> flexibilitat que busquem.

---

## 1. El problema

### 1.1 Duplicats transitoris

El flux real de preparació d'un assaig o una actuació és:

1. es decideixen les figures que es provaran,
2. després qui participa a cada figura,
3. i finalment l'ordre dels segments i si cada figura és completa o parcial (remat, pom, peu).

Tot això **canvia fins a l'últim moment**. Com que les pinyes ja poden estar fetes i la gent es
mou, aquests canvis tardans produeixen rutinàriament **la mateixa persona assignada dues vegades
dins un segment**, o fins i tot dins la mateixa figura.

La restricció "una persona no pot estar en dos llocs a la vegada" és real — però durant la
*planificació*, un duplicat transitori és un estat intermedi normal. Avui el sistema el fa
**irrepresentable**:

- `assign()` retorna un **409** i simplement no et deixa crear la segona assignació
  (`node-assignment.service.ts:446-471`);
- el flux de reassignació **esborra l'assignació anterior** en confirmar
  (`pinyes-tab.component.ts:453-462`);
- moure una figura entre segments **obliga a destruir un dels dos costats** de cada conflicte abans
  de deixar-te moure (`figure-instance.service.ts:251-257` + modal a
  `segment-manager.component.html:594-651`).

Conseqüència pràctica: els tècnics perden col·locacions que encara necessitaven, o se les enginyen
per esquivar l'eina.

**Cas reproduïble.** Event `29b88c09-a57c-4de6-9ce8-894b91610a99`
(`/events/29b88c09-.../?tab=pinyes`), amb dos segments: `Pinets` (sortOrder 0) i un segment sense nom
(sortOrder 1) amb *Remat de Xopera + Piló*. Movent el Piló del segment 2 al segment 1 hi ha persones
repetides, i el modal només ofereix **dues opcions, totes dues destructives**.

### 1.2 Context: troncs primer, pinyes després

Aquests fets de camp **no es tradueixen en permisos** — es tradueixen en com es classifiquen els
avisos i quins números veu el tècnic:

| Fet de camp | Conseqüència per al producte |
|---|---|
| Primer es munten els troncs de tots els segments; després les pinyes, amb la gent que no és al tronc | El "lliure" del panell de persones vol dir coses diferents segons la pestanya on treballes (§5.4) |
| Moure gent de pinya és barat; moure gent de tronc és car i té conseqüències en cadena | Un conflicte que involucra un tronc **no val el mateix** que un entre dues pinyes: ha d'aparèixer abans a la llista i amb un suggeriment diferent (§4.1) |
| Les pinyes són molt més gent i pateixen molts més canvis | Els avisos de pinya han de ser barats i discrets; els de tronc, escassos i sonors — si tots criden igual, es deixen de mirar |
| Un sol canvi al tronc pot obligar a reajustar tot l'event | Cal veure **l'impacte derivat** d'un canvi de tronc (qui queda duplicat, quins nodes queden buits) i la càrrega per persona a nivell d'event |
| Es busca una participació equilibrada | Cal una mètrica per persona (quantes col·locacions, quantes de tronc) i poder ordenar per ella |

---

## 2. Estat verificat (05/08/2026)

| Comprovació | Resultat |
|---|---|
| Constraints a la BBDD | Les **tres** actives: `UQ_node_assignments_instance_node`, `UQ_node_assignments_instance_person`, `UQ_node_assignments_segment_person` (`node-assignment.entity.ts:16-18`) |
| `SegmentMoveConflictResolution` | Només `KEEP_TARGET` i `KEEP_MOVED`. **No hi ha `KEEP_BOTH`** |
| `FigureInstanceService.move()` | Llança `SEGMENT_MOVE_CONFLICT` (409) quan hi ha conflicte i no s'ha triat resolució (`:251-257`); resolució destructiva dins la transacció (`:268-278`) |
| Migració que elimini constraints | **No existeix** |
| Zona a l'assignació | **No existeix.** La zona viu al node (`instance_nodes.zone`); tota pregunta tronc/pinya és un JOIN. No hi ha índex per zona |
| Comptadors de persones distintes al servidor | **No existeixen.** `freePersonsCount` / `totalConfirmedCount` es calculen al client (`assignment-state.service.ts:52-68`) i **no es renderitzen enlloc** |
| Lock | Només temporal i per event (`ASSIGNMENT_LOCK_DAYS`, `node-assignment.service.ts:1292-1374`). Cap lock per segment ni per figura — i no se n'afegeix cap |

### Bugs de "primera coincidència" ja presents (independents del canvi de règim)

Aquests col·lapsen files vàlides **avui mateix** i s'han d'arreglar abans de res:

1. `node-assignment.service.ts:606` — `new Map(targetAssignments.map(a => [a.person.id, a]))` dins
   `getSegmentMoveConflicts()`: diverses files per persona col·lapsen a l'última, i `isTronc` (`:612`)
   surt d'una fila arbitrària.
2. `available-persons.service.ts:177-193` — `assignedDetails: Map<personId, …>` amb `.set()` en bucle:
   el badge "Assignada a…" mostra una col·locació arbitrària.
3. `pinyes-tab.component.ts:404-406` i `troncs-tab.component.ts:290-292` —
   `.find(a => a.figureInstanceId === … && a.person.id === …)` a `onAssignedPersonSelected`.

---

## 3. Decisions preses (D1–D8, 17/07/2026)

| # | Qüestió | Decisió |
|---|---------|---------|
| D1 | Abast dels duplicats | Permesos **dins un segment i dins la mateixa figura**. Només sobreviu la unicitat **per node** (`UQ_node_assignments_instance_node`). Sense avís a nivell d'event |
| D2 | Bloquejos durs | **Cap.** Els conflictes no bloquegen mai cap acció (assignar, moure, projectar, lock) — sempre avisos sonors |
| D3 | Moure figura | Per defecte **es queda tot**. `KEEP_TARGET`/`KEEP_MOVED` passen a ser dreceres opcionals de neteja; el nou defecte és `KEEP_BOTH` |
| D4 | Desplegament | Fases additives + release final de canvi. Sense feature flag |
| D5 | Import massiu | Importar els duplicats i marcar-los com a conflicte. Només se segueixen saltant les files amb node ocupat o sense node equivalent |
| D6 | Mode POM | **Fora d'abast**, spec separat. `FigureMode` no es toca |
| D7 | UX del conflicte | Banner + panell de conflictes al taller, amb resolució d'un toc (un `unassign`, desfable) |
| D8 | Panell de persones | Les assignades es veuen i es marquen, **però duplicar no ha de ser mai fàcil**: "Assignar igualment" existeix amb estil d'avís i sempre darrere d'un diàleg |

**Conseqüència de D8: fricció deliberada.** Seleccionar o deixar caure una persona ja assignada
**sempre obre el diàleg** — mai un duplicat silenciós ni un robatori silenciós de posició. Ordre de
prominència: **"Moure ací"** (primari, comportament actual), *"Anar-hi"*, *"Cancel·lar"*, i
**"Assignar igualment"** amb estil d'avís i text explícit: *"Quedarà assignada a 2 llocs d'este
segment"*. Cap camí massiu crea duplicats silenciosament, excepte l'import de pinya, que els marca
com a conflicte immediatament (D5) i en reporta el recompte.

---

## 4. Decisions noves (D9–D13)

| # | Qüestió | Decisió |
|---|---------|---------|
| D9 | Tronc vs pinya en un conflicte | Es distingeix **només com a heurística física**, no organitzativa: com que reubicar gent de pinya és barat i tocar el tronc és car, el suggeriment d'un toc en un conflicte tronc↔pinya és *treure la col·locació de pinya*. És un **defecte suggerit**, mai una restricció: qualsevol tècnic pot resoldre'l al revés amb el mateix nombre de clics |
| D10 | Àrea d'una assignació | Es deriva de `instanceNode.zone` amb un únic helper compartit: **BASE compta com a TRONC** a efectes de conflictes i dotació. Els comptadors de completesa existents que fan `PINYA + BASE` **no es toquen** (§5.3) |
| D11 | Impacte d'un canvi de tronc | **Derivat, no persistit**: després d'escriure a un node de tronc, es calculen els conflictes nous i els nodes de pinya que han quedat buits. Cap taula nova, cap estat de muntatge, cap flag "troncs tancats" |
| D12 | Conflictes entre segments | Segueixen sent **legals i sense avís** (D1). El que es fa és mesurar **càrrega per persona** event-wide (§7, Fase 6). Si dos segments amb `startTime`/`endTime` solapats comparteixen persona, es pot marcar com a avís informatiu — opcional, mai bloquejant |
| D13 | Una sola font de conflictes | `getSegmentConflicts(segmentId)` (node-assignment) és **l'única** implementació de "què és un conflicte en aquest segment". `event-participation.service.ts` no reimplementa el càlcul: hi crida (o, si per rendiment cal mantenir la seva pròpia agregació batch, un test d'equivalència assegura que mai divergeixen). Sense això, la matriu de Participació i el taller podrien discrepar sobre el mateix segment — inacceptable en una eina que existeix per donar confiança sobre l'estat físic real |

### 4.1 Taxonomia de conflictes (nucli del disseny nou)

Un conflicte segueix sent **>1 col·locació d'una persona dins el MATEIX segment**. El que és nou és
que ara **es classifica**, però només per decidir **l'ordre** i el **suggeriment** — no l'aparença.
**Un conflicte és un conflicte**: mateix color, mateix estil d'avís, mateix banner, sigui quin sigui
el tipus. El que canvia és quin puja primer a la llista i què proposa resoldre:

| Tipus | Situació | Ordre a la llista | Suggeriment d'un toc |
|---|---|---|---|
| `TRONC_TRONC` | ≥2 col·locacions a nodes TRONC/BASE | 1r | Cap automàtic — les dues opcions són cares, decideix la persona |
| `TRONC_PINYA` | 1 a tronc + ≥1 a pinya | 2n | Treure **totes** les col·locacions de pinya (D9), amb l'alternativa "treu la del tronc" al costat |
| `PINYA_PINYA` | ≥2 col·locacions a pinya | 3r | Deixar-ne una (la de cordó més interior) i treure les sobreres |

Amb 169 assignacions i 86 persones (dades reals de dev), hi haurà molts més `PINYA_PINYA` que
`TRONC_TRONC` — l'ordenació ja fa que els que costen més de resoldre físicament (tocar un tronc) es
vegin abans, sense necessitat de distingir-los visualment ni d'introduir nivells de severitat.

**Precedència en el cas mixt.** Una persona pot tenir alhora ≥2 col·locacions de tronc **i** una o
més de pinya (3+ placements al mateix segment). `kind` és un sol valor per persona, així que cal una
regla: **si hi ha ≥2 col·locacions TRONC/BASE, el conflicte és `TRONC_TRONC`** sencer, independentment
que també hi hagi pinya de per mig — és el cas més car i no s'ha d'amagar rere un `TRONC_PINYA`.
`suggestedRemovalAssignmentIds` hi pot incloure igualment les col·locacions de pinya (són les barates
de treure), encara que el `kind` reportat sigui `TRONC_TRONC`.

---

## 5. Semàntica dels comptadors (repensada)

Aquest és el punt on és més fàcil trencar el feedback del tècnic, així que es fixa la convenció
abans d'escriure codi.

### 5.1 Tres preguntes, tres famílies de números

| Pregunta | Família | Unitat |
|---|---|---|
| *Està coberta la figura?* | completesa | **assignacions** (ocupació de nodes) |
| *Quants cossos necessite?* | dotació | **persones distintes** |
| *Este pla es pot fer físicament?* | conflicte | **persones en conflicte**, per tipus |

### 5.2 Inventari per nivell

| Nivell | Número | Significat | On es veu | Estat |
|---|---|---|---|---|
| Node | ocupat / lliure | binari | canvas, tronc-view | sense canvis |
| Instància | `assignedCount` | assignacions | "X/Y" de tot arreu | **sense canvis** |
| Instància | `distinctPersonCount` | persones distintes | tooltip | nou |
| Instància | `conflictAssignmentCount` | assignacions d'una persona en conflicte | badge a la figura | nou |
| Segment | `assignmentCount` | assignacions | píndola `segment-manager` | existent (`EventSegmentSummary`) |
| Segment | `distinctPersonCount` | persones distintes | tooltip de la píndola | nou |
| Segment | `tronc.distinctPersonCount` / `pinya.distinctPersonCount` | dotació per àrea | tooltip de la píndola | nou |
| Segment | `conflictPersonCount` + `conflictsByKind` | conflictes per tipus (per a l'ordre, no per a l'estil) | píndola + banner | nou |
| Segment | `pinyaEligibleCount` | confirmats − persones al tronc del segment | capçalera del taller, tab Pinyes | nou, **calculat al client a la Fase 3** sobre `assignedInTronc` (Fase 1) — sense endpoint propi |
| Event | `meta.conflictedPersons` | persones amb algun conflicte | capçalera Participació | **ja existeix** |
| Event | `placementCount` / `troncPlacementCount` per persona | càrrega i equilibri | columnes ordenables a Participació | nou |

### 5.3 Trampa a documentar: BASE compta a dues bandes

El codi actual és **deliberadament inconsistent** amb BASE i s'ha de mantenir així:

- conflictes de moviment: `TRONC_ZONES = {TRONC, BASE}` (`node-assignment.service.ts:605`);
- comptadors de pinya: `zone IN ('PINYA','BASE')` (`event-segment.service.ts:243-258`,
  `figure-instance.service.ts:500-503`), perquè la BASE es dibuixa al canvas de pinya.

**D10 tanca el debat:** l'helper nou `areaForZone()` posa BASE a `TRONC` (conflictes, dotació per
àrea), i les queries de completesa existents es queden com són. Es documenta amb un comentari a
l'helper i un test que asserta les dues lectures a propòsit, perquè ningú "unifiqui" això per error.

### 5.4 Dedupe pendent

`freePersonsCount` / `totalConfirmedCount` (`assignment-state.service.ts:52-68`) han de comptar
persones **distintes** (dedupe per `personId`) i el significat de "lliure" ha de dependre de la
pestanya on treballes, no de qui ets:

- pestanya **Troncs**: lliure = *no assignada a cap node de tronc d'este segment*;
- pestanya **Pinyes**: lliure = *no assignada a res d'este segment* (perquè la gent del tronc ja té
  el seu lloc; si la vols també a la pinya, és un duplicat conscient — D8).

Avui es calculen i no es renderitzen: bon moment per treure'ls a la capçalera del taller amb el
significat correcte per pestanya.

---

## 6. Superfície nova compartida (`libs/shared`)

```ts
// enums/assignment-area.enum.ts
export enum AssignmentArea { TRONC = 'TRONC', PINYA = 'PINYA', DIRECTION = 'DIRECTION' }

// enums/segment-conflict.enum.ts
// Ordre d'aparició a llistes/banner: TRONC_TRONC, TRONC_PINYA, PINYA_PINYA.
// No hi ha severitat: els tres es pinten i s'anuncien igual.
export enum SegmentConflictKind { TRONC_TRONC, TRONC_PINYA, PINYA_PINYA }

// enums/segment-move-conflict-resolution.enum.ts  → + KEEP_BOTH

// constants/assignment-area.constants.ts
export function areaForZone(zone: FigureZone): AssignmentArea | null; // BASE → TRONC (D10)

// interfaces/pinyes/segment-conflict.interfaces.ts
export interface ConflictPlacement {
  assignmentId: string; figureInstanceId: string; figureName: string;
  nodeId: string; nodeLabel: string | null;
  zone: FigureZone; area: AssignmentArea;
  z: number | null; renglaPosition: number | null; cordon: number | null;
}
export interface SegmentConflict {
  personId: string; personAlias: string;
  placements: ConflictPlacement[];               // sempre ≥2, ordenades tronc-primer
  kind: SegmentConflictKind;                     // determina ordre i suggeriment, no l'estil
  suggestedRemovalAssignmentIds: string[];       // buit si kind === TRONC_TRONC
}
export interface SegmentPeopleCounters { /* §5.2, nivell segment */ }
export interface SegmentConflictsResponse { data: SegmentConflict[]; meta: SegmentPeopleCounters; }
export interface TroncChangeImpact {             // D11, derivat
  newConflicts: SegmentConflict[];
  freedPinyaNodeIds: string[];
}
```

`AvailablePerson` guanya (mantenint els camps singulars fins a la Fase 7):

```ts
assignedPlacements: ConflictPlacement[];   // totes, ordenades tronc-primer
assignedInTronc: boolean;
assignedInPinya: boolean;
conflictInSegment: boolean;
```

---

## 7. Pla per fases

Cada fase és desplegable i testable per separat. **El comportament de duplicats només canvia a la
Fase 5.** Les fases 0–4 renderitzen dades que en producció arriben buides perquè les constraints
encara hi són. Vuit fases en lloc de sis del disseny inicial: es divideixen les dues fases més grosses
per aïllar treball de risc diferent — un refactor d'una feature ja en producció (Fase 2) del backend
additiu pur, i el codi purament visual (Fase 3) del que introdueix camins de mutació i undo nous
(Fase 4).

### Fase 0 — Fonaments i bugs de col·lapse (sense canvi de comportament)

Objectiu: deixar el codi capaç de manejar *n* files per persona abans que n'hi pugui haver més d'una.

1. `libs/shared`: `AssignmentArea`, `areaForZone()`, `SegmentConflictKind`, `KEEP_BOTH` a
   l'enum de resolució. Índex a `libs/shared/src/index.ts`.
2. Arreglar els tres col·lapses de §2: `getSegmentMoveConflicts()` (`node-assignment.service.ts:590-617`)
   passa a retornar `SegmentMoveConflict { personId; placements[]; kind }`;
   `available-persons.service.ts:177-193` acumula en array; `onAssignedPersonSelected` dels dos tabs
   recull **totes** les coincidències.
3. Índexs `(segmentId, personId)` i `(figureInstanceId, personId)` — inofensius al costat de les
   uniques i imprescindibles després (migració additiva).
4. Substituir les llistes de zones ad-hoc per `areaForZone()` **només** on el significat és
   tronc/pinya conceptual (move conflicts, tronc-view, `targetTabForZone`), **no** a les queries de
   completesa (§5.3).
5. Tests: unitaris de l'helper (incloent BASE), i reescriure els 5 tests de `getSegmentMoveConflicts`
   (`node-assignment.service.spec.ts:679-767`) al contracte plural.

**Fet quan:** `nx test api` i `nx test dashboard` verds sense cap canvi observable a la UI.

### Fase 1 — Motor de conflictes (backend additiu, només lectura)

1. `getSegmentConflicts(segmentId)` — **font canònica única** (D13): una query
   (`node_assignments JOIN instance_nodes` amb `GROUP BY personId HAVING COUNT(*) > 1`, després
   hidratació de col·locacions), classificació per `areaForZone` (`kind` + `suggestedRemovalAssignmentIds`,
   amb la regla de precedència del cas mixt §4.1; sense severitat — l'ordre de la resposta ja ve
   `kind`-ordenat, TRONC_TRONC primer).
2. Endpoint `GET events/:eventId/segments/:segmentId/conflicts` → `SegmentConflictsResponse`
   (`node-assignment.controller.ts`).
3. Camps de conflicte i dotació a:
   - `event-segment.service.ts:63-90` `findAllByEvent()` (+ un loader agregat nou, en paral·lel amb
     els 4 existents),
   - `node-assignment.service.ts:809-917` `getEventAssignmentSummary()` (per segment i per figura),
   - `projection.service.ts:10-42` `ProjectionData` (els tècnics projecten durant l'assaig: és
     l'última línia de defensa).
4. `available-persons.service.ts`: `assignedPlacements[]`, `assignedInTronc/InPinya`,
   `conflictInSegment` (sempre `false` de moment). `excludeAssigned` manté el defecte `true`; la
   distinció per àrea la fa el client sobre les anotacions (cap paràmetre nou).
5. Tests: unitaris de classificació (els 3 tipus + el cas mixt de precedència + cas negatiu entre
   segments) i **integration test** que droppi `UQ_node_assignments_segment_person` dins el test per
   veure conflictes reals — el patró ja existeix a `event-participation.integration.spec.ts:303`.

No inclou encara `TroncChangeImpact` (Fase 3, on es consumeix per primer cop) ni el refactor de
Participació (Fase 2, aïllat perquè toca una feature ja en producció).

**Fet quan:** els nous camps existeixen a Swagger, en producció valen `0`/`[]`, i cap resposta
existent canvia de forma.

### Fase 2 — Participació sobre la font canònica

Fase petita i aïllada a propòsit: **no afegeix res nou**, substitueix l'algorisme intern d'una
feature ja en producció i testada (la pestanya Participació, commit `8a1c267`) perquè deixi de
divergir de `getSegmentConflicts` (D13). Si alguna cosa regressiona aquí, ha de poder-se aïllar sense
implicar el motor de conflictes nou ni el taller.

1. `event-participation.service.ts` substitueix el `placements[segmentId].length > 1` intern per una
   crida a `getSegmentConflicts()` — o, si el cost de N crides per segment és massa alt per a la
   matriu completa, es manté la seva agregació batch pròpia però amb un **test d'equivalència
   obligatori** que compari totes dues implementacions sobre el mateix dataset.
2. Afegir `area` a `EventParticipationPlacement`, i a `meta` els agregats `conflictsByKind` i
   `troncPlacements`. Per persona: `troncPlacementCount`.
3. Tests: el test d'equivalència del punt 1, i el test negatiu existent entre segments
   (`event-participation.service.spec.ts:318`) verd sense canvis.

**Fet quan:** la pestanya Participació es comporta exactament igual que abans en dades reals, i el
test d'equivalència passa.

### Fase 3 — El taller en mode lectura (renderitza dades buides)

Cobreix la visibilitat **dins el taller**, on el tècnic treballa segment a segment (l'event-wide ja
la dona Participació). Tot el que segueix és **visual**: no introdueix cap camí de mutació nou, així
que no pot trencar res encara que hi hagi conflictes reals.

1. Models del dashboard: `assignment.model.ts`, `segment.model.ts`, `participation.model.ts` amb
   placements plurals, àrea i conflictes.
2. **Estil de conflicte** a `figure-canvas` (tots els modes, inclòs `projection`) i `tronc-view` — un
   únic estil visual d'avís (mateix color/icona), independent del `kind`.
3. Píndoles del `segment-manager` (`:612-639`): fragment `⚠ N conflictes` i dotació per àrea al
   tooltip.
4. `AlreadyAssignedDialog` → multi-col·locació: llista totes les col·locacions existents amb la seua
   àrea i avisa quan una d'elles és de tronc. Encara només informatiu — "Assignar igualment" **no es
   mostra** i el diàleg no ofereix cap acció nova.
5. **Impacte del canvi de tronc, al backend (D11):** `assign`/`unassign`/`swap` sobre un node
   TRONC/BASE, **i `move()` d'una figura que contingui nodes TRONC/BASE**, retornen
   `impact: TroncChangeImpact`. Reaprofita `getSegmentConflicts` (Fase 1) + un recompte de nodes
   buits; no afegeix estat ni bloqueja res. `move()` és probablement la via més gran de canvi de
   tronc a la pràctica i no es pot deixar fora. Es consumeix a la Fase 4 — aquí només s'envia.
6. Tests: unitaris de l'estil per `kind`, de les píndoles i de `TroncChangeImpact`.

**Fet quan:** amb dades de producció (zero conflictes) la UI és idèntica a l'actual excepte els
comptadors nous de dotació; amb dades sembrades a mà l'estil de conflicte es veu a tot arreu (canvas,
tronc-view, projecció) però encara no hi ha manera d'actuar-hi des del taller.

### Fase 4 — Resolució interactiva al taller

Aquí és on el taller **actua** sobre els conflictes — introdueix camins de mutació i entrades d'undo
nous, així que es manté separada de la Fase 3 perquè pugui rebre la revisió i les proves que aquesta
mena de codi necessita (risc 6, §8) sense arrossegar els canvis purament visuals.

1. **Banner + panell de conflictes** al `segment-workspace` quan `conflictPersonCount > 0`, amb **un
   sol estil d'avís** per a tots: persona → totes les col·locacions (amb icona d'àrea) → "Treu esta"
   (un `unassign` desfable). Ordenats per `kind` (TRONC_TRONC i TRONC_PINYA primer), no per color.
   Per a `TRONC_PINYA`, un botó **"Allibera la pinya"** que aplica
   `suggestedRemovalAssignmentIds` en **una sola** entrada d'undo, amb l'alternativa "treu la del
   tronc" al costat i igual d'accessible (D9).
2. **Llista de revisió** al mateix panell, alimentada pel `TroncChangeImpact` de la Fase 3 i pels
   conflictes: persones duplicades + nodes de pinya buits + persones lliures (§5.4). Toast persistent
   "N pinyes a revisar" després d'un canvi de tronc, que obre aquesta llista.
3. Panell de persones, **simètric a les dues pestanyes** (una asimetria unidireccional ací deixaria
   sense avís just el moment en què es crea un conflicte, no només després): a Pinyes, bucket nou
   **"Al tronc d'este segment"** separat de "Assignades"; a Troncs, bucket equivalent **"Ja a la
   pinya d'este segment"**. Significat de "lliures" per pestanya segons §5.4.
4. Modal de moure redissenyat (tres opcions, `KEEP_BOTH` primera i per defecte, i el compte de
   conflictes que involucren troncs destacat), **darrere del flux forçat actual** fins a la Fase 5.
5. Tests Vitest dels comptadors deduplicats, de l'ordenació per `kind`, del bucket de tronc, i de les
   noves entrades d'undo ("Allibera la pinya" com una sola entrada, no *n*).

**Fet quan:** amb dades sembrades a mà els tres tipus de conflicte es veuen i es resolen d'un toc, amb
undo, i cap acció massiva crea duplicats silenciosos.

### Fase 5 — El canvi de règim (una sola release coordinada)

1. **Migració**: eliminar `UQ_node_assignments_instance_person` i `UQ_node_assignments_segment_person`;
   treure els `@Unique` de l'entitat i corregir el comentari de `segment` (avui diu que la columna hi
   és per garantir unicitat; en realitat hi queda per fer barates les queries de conflictes i el
   re-apuntat en moure). **La down-migration ha d'esborrar duplicats (mantenint el més antic) abans
   de tornar a posar-les**, documentat dins la migració.
2. `assignWithoutLockCheck()` (`:446-471`): treure els dos pre-checks de persona, retornar els
   `conflicts` resultants; retallar `toAssignConflictError` (`:1506-1519`) a la branca del node.
3. **`swap()` (`:497-565`), oblidat en el disseny original.** Avui no passa per
   `assignWithoutLockCheck()` ni pels seus pre-checks, i **no envolta el `save()` en cap try/catch**:
   si la unique constraint fallés, l'excepció crua de Postgres pujaria com a 500 (bug ja existent,
   independent d'aquest pla). Un cop caiguin les constraints, `swap()` no calcularà mai `conflicts` —
   cal que retorni `conflicts`/`impact` igual que `assign()`, perquè un intercanvi (inclòs
   `triggerCrossSwap` entre figures diferents) és una via habitual de crear un `TRONC_TRONC` sense
   avís si es deixa com està.
4. `move()` (`:232-302`): `KEEP_BOTH` per defecte, sense 409. La resposta inclou els conflictes creats
   (i `impact` si la figura moguda té nodes de tronc, D11 — vegeu Fase 3, punt 5).
5. `bulkImport()` (`:1002-1200`): importar i marcar (D5), reportant el recompte per tipus.
6. Frontend: activar "Assignar igualment" amb la fricció de D8, treure els toasts de 409 de persona,
   commutar el modal de moure al nou, canviar el text del toast d'import.
7. Tests: reescriure els que asserten el 409 com a comportament correcte
   (`node-assignment.service.spec.ts:444-505`, `figure-instance.service.spec.ts:515-545`,
   `event-segment.controller.spec.ts:148-167`), afegir tests de `swap()`/`triggerCrossSwap` retornant
   `conflicts` sense excepció, i e2e: *assignar duplicat → banner → resoldre des del panell → desfer*.

**Checklist de greps abans de desplegar:** `assignedInstanceId`, `find(a => a.person`,
`status === 409`, `SEGMENT_MOVE_CONFLICT`, `PERSON_IN_SEGMENT`, `PERSON_IN_INSTANCE`, i totes les
crides a `swap(` (backend i dashboard) per confirmar que gestionen `conflicts` a la resposta.

### Fase 6 — Equilibri de participació event-wide

Un canvi de tronc pot obligar a reajustar tot l'event; aquesta fase dona les dades per fer-ho amb
criteri. Gairebé tot és frontend sobre el payload de Participació ja ampliat a la Fase 2. No bloqueja
ni depèn de la Fase 5: es podria avançar en paral·lel si convé.

1. Filtre d'**àrea** a la pestanya Participació (Tot / Només troncs / Només pinyes) i **matriu de
   troncs** event-wide: persona × segment amb només col·locacions de tronc — la vista per decidir
   canvis de tronc veient-ne l'abast.
2. Columnes ordenables de **càrrega**: `placementCount`, `troncPlacementCount` i el % de segments en
   què participa. Estadística de capçalera: mín/mitjana/màx i comptador de "persones sense cap
   col·locació" (candidates naturals per equilibrar).
3. Al panell de persones del taller, ordre opcional **"menys carregades primer"** dins de cada bucket
   (usa el recompte event-wide, no només el segment) — l'eina pràctica per repartir participació.
4. Avís informatiu opcional (D12) quan dos segments amb `startTime`/`endTime` solapats comparteixen
   persona. Mai bloquejant, desactivat si els segments no tenen hores.
5. Tests: unitaris de les mètriques de càrrega i del filtre d'àrea.

### Fase 7 — Seguiments (specs separats)

- Retirar els camps singulars `assignedInSegment`/`assignedInstanceId`/`assignedNodeLabel`/
  `assignedNodeCordon` un cop cap consumidor els use.
- Resolució massiva i per teclat al panell de conflictes; bulk "allibera totes les pinyes d'un cop".
- Log auditable de canvis de tronc reaprofitant `AuditAction` (D11 el deixa derivat).
- Mode POM (D6); estil de conflicte a la PWA quan hi arribin vistes de membre; F1 de [[DEBT]] (taller
  inusable per sota de 639px) afecta directament els panells nous.

---

## 8. Riscos

1. **Bugs silenciosos de "primera coincidència".** Qualsevol `.find(personId)` no migrat agafarà una
   fila arbitrària. Mitigació: la Fase 0 els arregla *abans* que hi puga haver duplicats, i el
   checklist de greps de la Fase 5 es torna a passar abans de desplegar.
2. **Fatiga d'avisos.** Amb molts més `PINYA_PINYA` que `TRONC_TRONC`, si tots pesen igual a la
   llista el tècnic pot perdre de vista els que costen més de resoldre. Mitigació: l'**ordre** de
   §4.1 (TRONC_TRONC i TRONC_PINYA primer) i prou — es descarta deliberadament un segon nivell
   visual (severitat/color) perquè no aportava més que l'ordenació i complicava la implementació.
3. **Confusió de recomptes.** "Per node" i "persones distintes" divergiran visiblement, i BASE compta
   a dues bandes (§5.3). Mitigació: convenció de §5 + tooltips + el recompte de conflictes sempre al
   costat del de completesa + test que fixa la doble lectura de BASE.
4. **Que el suggeriment es llegisca com una regla.** El defecte "treu la pinya" (D9) no ha de fer
   sentir que canviar un tronc estiga prohibit. Mitigació: l'acció alternativa sempre visible i amb el
   mateix nombre de clics; cap missatge que parle de qui pot fer què.
5. **Pèrdua de dades a la down-migration, i sense via de reversió barata un cop en producció.** Tornar
   a posar les constraints exigeix esborrar duplicats. Acceptable en dev/pre; **en producció, un cop
   la Fase 5 estigui activa i els tècnics ja hagin creat duplicats legítims** (que és el propòsit de
   la funcionalitat), qualsevol rollback destrueix aquesta feina real. Amb D4 (sense feature flag) no
   hi ha marxa enrere sense migració destructiva. Mitigació: **dump/backup explícit de
   `node_assignments` com a pas obligatori del desplegament de la Fase 5**, no només documentar-ho
   dins la migració.
6. **Desfer amb duplicats.** Les entrades ASSIGN/UNASSIGN/MOVE/SWAP d'`UndoRedoService`
   (`undo-redo.service.ts` + els `build*Action` dels dos tabs) s'han de reverificar quan la persona té
   altres col·locacions; "Allibera la pinya" ha de ser **una** entrada d'undo, no *n*.
7. **Cost de les queries de conflicte.** Tota pregunta tronc/pinya és un JOIN a `instance_nodes` sense
   índex per zona. Mitigació: índexs de la Fase 0, agregació en un sol loader dins
   `findAllByEvent()`/`getEventAssignmentSummary()` (que ja són batched), i mesura amb l'event real de
   §1.1 abans de la Fase 3.
8. **Clients antics durant el desplegament.** Fases 0–4 són retrocompatibles (camps additius). Només
   la Fase 5 canvia semàntica, i va en una release coordinada — la colla és un desplegament
   single-tenant.
9. **Dues fonts de conflictes que divergeixen (D13).** Si `event-participation.service.ts` manté un
   càlcul propi en lloc de reutilitzar `getSegmentConflicts()`, la matriu de Participació i el taller
   poden discrepar sobre el mateix segment. Mitigació: font única, o test d'equivalència obligatori
   entre totes dues implementacions (Fase 2, punt 1).
10. **`swap()` sense cobertura.** No passa pels pre-checks d'`assign()` ni retorna `conflicts`; avui
    un error de constraint hi pujaria com a 500 cru en lloc de 409. Mitigació: Fase 5, punt 3.

---

## 9. Deute documental

Hi ha tres documents més antics (17/07/2026) a la branca local `docs/segments-flexibility-report`
(informe del comportament actual, proposta i anàlisi d'implementació amb l'inventari fitxer-a-fitxer i
les decisions D1–D8). Aquest document ja plega el seu contingut vigent. **Aquella branca es va
escriure per a `docs/specs/`, un directori que la neteja de documentació ha eliminat**: si es fusiona
tal com està, el tornarà a crear. Cal descartar-la o extreure'n només el que hi falte aquí abans de
fusionar.

En implementar: actualitzar [[PINYES_MODULE]] (§14 invariants — l'invariant #4 "una persona per
segment" desapareix a la Fase 5, i n'apareix un de nou sobre la classificació de conflictes), [[DATA_MODEL]]
(uniques de `node_assignments`) i [[ROADMAP]]. Després de tocar entitats, `pnpm run docs:map` i
`pnpm run docs:model`.

---

*Veïns: [[PINYES_MODULE]] · [[DATA_MODEL]] · [[ROADMAP]] · [[DEBT]]*
