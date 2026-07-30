---
tags: [domini]
---

# Flexibilitat de segments — pla pendent

> **Estat: dissenyat, no implementat.** Cap línia d'aquest document està al codi.
> Verificat contra el codi i la BBDD local el **27 de juliol de 2026**.
>
> Objectiu: que una persona pugui estar assignada **dues vegades dins el mateix segment** mentre
> es prepara un event, amb un avís molt clar, en lloc que el sistema ho bloquegi o esborri
> assignacions pel seu compte.

---

## 1. El problema

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

- `assign()` retorna un **409** i simplement no et deixa crear la segona assignació;
- el flux de reassignació **esborra l'assignació anterior** en confirmar;
- moure una figura entre segments **obliga a destruir un dels dos costats** de cada conflicte
  abans de deixar-te moure.

Conseqüència pràctica: els tècnics perden col·locacions que encara necessitaven, o se les
enginyen per esquivar l'eina.

### Cas reproduïble

Event `29b88c09-a57c-4de6-9ce8-894b91610a99` (`/events/29b88c09-.../?tab=pinyes`), amb dos
segments: `Pinets` (sortOrder 0) i un segment sense nom (sortOrder 1) amb *Remat de Xopera +
Piló*. Movent el Piló del segment 2 al segment 1 hi ha persones repetides, i el modal només
ofereix **dues opcions, totes dues destructives**.

---

## 2. Estat verificat avui (27/07/2026)

| Comprovació | Resultat |
|---|---|
| Constraints a la BBDD local | Les **tres** actives: `UQ_node_assignments_instance_node`, `UQ_node_assignments_instance_person`, `UQ_node_assignments_segment_person` |
| `SegmentMoveConflictResolution` | Només `KEEP_TARGET` i `KEEP_MOVED`. **No hi ha `KEEP_BOTH`** |
| `FigureInstanceService.move()` | Llança `SEGMENT_MOVE_CONFLICT` (409) quan hi ha conflicte i no s'ha triat resolució |
| Migració que elimini constraints | **No existeix** |

Fitxer i línia: `apps/api/src/modules/event-segment/figure-instance.service.ts:249-257` (el 409) i
`:268-278` (l'aplicació de la resolució destructiva dins la transacció).

> **Nota sobre documentació prèvia.** Hi ha tres documents més antics (17/07/2026) a la branca
> local `docs/segments-flexibility-report`: un informe del comportament actual, la proposta i una
> anàlisi d'implementació amb l'inventari exhaustiu i les decisions D1–D8. Aquell material segueix
> sent vàlid i és la font de detall fitxer-a-fitxer. **Però es va escriure per a `docs/specs/`, un
> directori que la neteja de documentació ha eliminat**: si aquella branca es fusiona tal com està,
> tornarà a crear `docs/specs/`. Cal reconciliar-ho (moure el contingut aquí o adaptar-lo a
> l'estructura plana actual) abans de fusionar-la.

---

## 3. Decisions ja preses (D1–D8, 17/07/2026)

| # | Qüestió | Decisió |
|---|---------|---------|
| D1 | Abast dels duplicats | Permesos **dins un segment i dins la mateixa figura**. Només sobreviu la unicitat **per node** (`UQ_node_assignments_instance_node`). Sense avís a nivell d'event |
| D2 | Bloquejos durs | **Cap.** Els conflictes no bloquegen mai cap acció (assignar, moure, projectar, lock) — sempre avisos sonors |
| D3 | Moure figura | Per defecte **es queda tot** (el moviment crea conflictes amb avís). `KEEP_TARGET`/`KEEP_MOVED` passen a ser dreceres opcionals de neteja; el nou defecte és `KEEP_BOTH` |
| D4 | Desplegament | Fases additives + release final de canvi. Sense feature flag |
| D5 | Import massiu | Importar els duplicats i marcar-los com a conflicte. Només se segueixen saltant les files amb node ocupat o sense node equivalent |
| D6 | Mode POM | **Fora d'abast**, spec separat. `FigureMode` no es toca |
| D7 | UX del conflicte | Banner + panell de conflictes al taller, amb resolució d'un toc (un `unassign`, desfable) |
| D8 | Panell de persones | Les assignades es veuen i es marquen, **però duplicar no ha de ser mai fàcil**: "Assignar igualment" existeix amb estil d'avís i sempre darrere d'un diàleg |

### Conseqüència de D8: fricció deliberada

Duplicar és sempre un acte explícit i confirmat:

- seleccionar o deixar caure una persona ja assignada **sempre obre el diàleg** — mai un duplicat
  silenciós ni un robatori silenciós de posició;
- ordre de prominència al diàleg: **"Moure ací"** (primari, comportament actual), *"Anar-hi"*,
  *"Cancel·lar"*, i **"Assignar igualment"** amb estil d'avís i text explícit: *"Quedarà assignada
  a 2 llocs d'este segment"*;
- cap camí massiu crea duplicats silenciosament, excepte l'import de pinya, que els marca com a
  conflicte immediatament (D5) i en reporta el recompte.

---

## 4. Què ha canviat des del disseny original

**La visibilitat event-wide dels conflictes ja existeix.** La pestanya **Participació**
(`/events/:id?tab=participacio`, commit `8a1c267`) es va construir amb **contracte plural a
propòsit** per aquest motiu:

- `GET /events/:eventId/participation` retorna `placements: Record<segmentId, Placement[]>` — un
  array, no un valor per cel·la — i el mapper no depèn de cap invariant d'unicitat;
- calcula `conflictSegmentIds` (segments on una persona té >1 col·locació) i
  `meta.conflictedPersons`;
- la matriu ja **avisa** d'aquests conflictes a tres nivells: comptador de capçalera amb filtre
  "Només conflictes", glif a la columna fixa de persona, i píndoles en estil d'avís a la cel·la;
- hi ha un test unitari que construeix l'estat duplicat directament, de manera que **ja passa sota
  els dos règims** i no caldrà reescriure'l.

Això vol dir que **la Fase 2 del pla original es redueix**: la superfície de "veure els conflictes
de tot l'event" està feta. El que falta és el costat d'**escriptura** (deixar-los crear) i la
visibilitat *dins el taller* (canvas, tronc-view, projecció), que és on el tècnic treballa segment
a segment.

### Dada de camp que condiciona el disseny

Sobre dades reals de desenvolupament (assaig amb 4 segments i 169 assignacions): **64 de 86
persones estan col·locades en més d'un segment**. Per tant:

> Un conflicte és **>1 col·locació dins el MATEIX segment**. Comptar-lo com "més d'una col·locació
> a l'event" marcaria el 74% de la colla com a error.

Estar en segments diferents és legal i no s'ha d'avisar mai (i D1 deixa l'avís entre segments
explícitament fora d'abast). La vista de participació ja ho fa bé i té test del cas negatiu.

---

## 5. Semàntica dels comptadors

Avui "assignacions" == "persones distintes" per segment. Amb duplicats, cada recompte ha de triar
un significat:

| Número | Significat | On |
|---|---|---|
| `assignedCount` (per instància) | **assignacions** (ocupació de nodes: com de plena és la figura) | sense canvis a tots els "X/Y" |
| `distinctPersonCount` (per segment) | persones distintes: quants cossos necessites | nou, tooltip de la píndola |
| `conflictCount` (per instància) | assignacions que pertanyen a una persona en conflicte | nou, badge |
| `conflictPersonCount` (per segment) | persones distintes amb >1 assignació | nou, píndola + banner |

Els números de completesa ("12/20 pinya") responen *"està coberta la figura?"* — un node ocupat ho
està independentment de si la persona també és en un altre lloc, així que **no canvien**. Els nous
números responen *"aquest pla es pot fer físicament?"*.

`freePersonsCount` / `totalConfirmedCount` (`assignment-state.service.ts`) han de comptar persones
**distintes** (dedupe per `personId`). Avui es calculen però no es renderitzen enlloc: bon moment
per mostrar-los a la capçalera del taller.

---

## 6. Pla per fases

Cada fase és desplegable i testable per separat. **El comportament només canvia a la Fase 3.**

### Fase 1 — Backend additiu (sense canvi de comportament)

Tot s'entrega amb les constraints encara posades, així que en producció totes les dades de
conflicte arriben buides.

1. `libs/shared`: valor `KEEP_BOTH` a l'enum, interfícies `SegmentConflict` / `ConflictPlacement`,
   `AvailablePerson.assignedPlacements[]` (mantenint els camps singulars).
2. `getSegmentConflicts(segmentId)` (`GROUP BY segmentId, personId HAVING COUNT(*) > 1`) +
   `GET events/:eventId/segments/:segmentId/conflicts`, i camps de conflicte a `findAllByEvent`,
   `getEventAssignmentSummary` i el payload de `ProjectionService`.
3. Arreglar `getSegmentMoveConflicts()`: el `Map(personId → assignment)` col·lapsa diverses files
   per persona (i dona un `isTronc` arbitrari). **Aquest fix és correcte sota els dos règims**, així
   que va aquí.
4. `available-persons`: `assignedPlacements` plural + `conflictInSegment` (sempre `false` per ara).
5. Índexs `(segmentId, personId)` i `(figureInstanceId, personId)` — inofensius al costat de les
   uniques.

### Fase 2 — Conflictes dins el taller (renderitza dades buides)

La visibilitat event-wide ja la dona la pestanya Participació (§4); aquesta fase cobreix el taller.

1. Models del dashboard: placements plurals i camps de conflicte.
2. **Banner** al `segment-workspace` quan `conflictPersonCount > 0` + **panell de conflictes**
   (persona → totes les col·locacions → "Treu esta", que és un `unassign` desfable).
3. **Estil de conflicte** a `figure-canvas` i `tronc-view` en *tots* els modes, inclòs `projection`
   — els tècnics projecten això durant l'assaig, és l'última línia de defensa.
4. Píndoles del `segment-manager` amb el fragment `⚠ N conflictes`.
5. Reescriure `AlreadyAssignedDialog` a multi-col·locació, i `onAssignedPersonSelected` als tabs
   Pinyes/Troncs per recollir **totes** les coincidències (avui fan `.find()` i n'agafen una
   arbitrària). "Assignar igualment" encara **no** es mostra.
6. Modal de moure redissenyat, darrere del flux forçat actual fins a la Fase 3.

### Fase 3 — El canvi (una sola release coordinada)

1. **Migració**: eliminar les dues uniques de persona; treure els `@Unique` de l'entitat i corregir
   el comentari de `segment` (avui diu que la columna hi és per garantir unicitat; en realitat hi
   quedarà per fer barates les queries de conflictes i el re-apuntat en moure).
   **La down-migration ha d'esborrar duplicats (mantenint el més antic) abans de tornar a posar-les.**
2. `assign()`: treure els pre-checks de persona, retornar `conflicts`; retallar
   `toAssignConflictError` a la branca del node.
3. `move()`: `KEEP_BOTH` per defecte, sense 409.
4. `bulkImport`: importar i marcar (D5).
5. Frontend: activar "Assignar igualment" amb la fricció de D8, treure els toasts de 409 de persona,
   canviar el text del toast d'import, commutar el modal de moure.
6. Reescriure els tests que avui asserten el 409 com a comportament correcte, i afegir e2e:
   *assignar duplicat → banner → resoldre des del panell → desfer*.

### Fase 4 — Seguiments (specs separats)

Retirar els camps singulars `assignedInstanceId`/`NodeLabel`/`Cordon`; poliment de la resolució
(bulk, teclat); mode POM (D6); avís opcional a nivell d'event (ajornat per D1); respectar l'estil de
conflicte a la PWA quan hi arribin vistes de membre.

---

## 7. Riscos

1. **Bugs silenciosos de "primera coincidència" després del canvi.** Qualsevol `.find(personId)`
   que no s'hagi migrat agafarà una fila arbitrària. Abans de la Fase 3, tornar a passar els greps
   com a checklist: `assignedInstanceId`, `find(a => a.person`, `status === 409`,
   `SEGMENT_MOVE_CONFLICT`.
2. **Pèrdua de dades a la down-migration.** Tornar a posar les constraints exigeix esborrar
   duplicats. Acceptable només en dev/pre; documentar-ho dins la migració.
3. **Confusió de recomptes.** "Per node" i "persones distintes" divergiran visiblement. Mitigació:
   la convenció de §5 més tooltips, i el recompte de conflictes sempre al costat del de completesa.
4. **Desfer amb duplicats.** Les entrades MOVE/ASSIGN d'undo s'han de reverificar quan la persona
   té altres col·locacions.
5. **Clients antics durant el desplegament.** Les fases 1–2 són retrocompatibles (camps additius).
   Només la Fase 3 canvia semàntica, i va en una release coordinada — la colla és un desplegament
   single-tenant.

---

*Veïns: [[PINYES_MODULE]] · [[DATA_MODEL]] · [[ROADMAP]] · [[DEBT]]*
