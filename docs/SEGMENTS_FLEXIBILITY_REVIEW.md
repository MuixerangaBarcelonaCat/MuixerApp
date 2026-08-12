---
tags: [qa]
---

# Flexibilitat de segments — revisió pre-tancament d'sprint

> Revisió de tot el que s'ha implementat a la branca `feat/sements-flexibility` (Fases 0–6),
> feta el **12 d'agost de 2026** contra el codi de `HEAD` (`a8b723b`). Complementa
> [[SEGMENTS_FLEXIBILITY]] (disseny) i [[SEGMENTS_FLEXIBILITY_PLAN]] (seguiment).
>
> Objectiu: recollir incongruències, errors possibles, coses no cobertes, coses descartades que poden
> ser un problema futur, i riscos/notes no coberts pel disseny — perquè després en surti un pla de
> tancament d'sprint. Cada troballa porta una recomanació i, quan cal una decisió de producte/abast,
> un marcador **[DECISIÓ PENDENT]**.
>
> **Veredicte general:** la implementació és sòlida i fidel al disseny. No hi ha cap bug bloquejant.
> D13 (font única de conflictes) es manté amb un test d'equivalència real; la fricció D8, la resolució
> d'un toc amb undo únic (D9/risc #6), el try/catch de `swap()` (risc #10) i la branca no-op de
> `KEEP_BOTH` estan tots correctament implementats i provats. El que segueix són arestes, no forats.

---

## Llegenda de severitat

- 🔴 **Alt** — pèrdua de dades o divergència visible per l'usuari; cal decidir abans de tancar.
- 🟠 **Mitjà** — incoherència real o forat de prova que pot morder en una fase futura.
- 🟡 **Baix** — deute latent, cosmètic o de manteniment; inofensiu avui.

---

## 1. Riscos operatius i de dades

### R1 🔴 — La down-migration destrueix duplicats legítims de producció, sense backup forçat
`apps/api/src/migrations/1783800000000-DropNodeAssignmentDuplicateUniques.ts:29-46`

Un cop la Fase 5 està en producció, tenir una persona amb ≥2 col·locacions en un segment/instància és un
estat **legal i buscat**. Si aquesta migració es reverteix, el `down()` **esborra silenciosament** aquestes
files (mantenint la més antiga) per poder tornar a posar les uniques. No hi ha `BEGIN`/taula d'arxiu, ni
log de recompte, ni dry-run, ni guard d'operador. El comentari de la classe només justifica l'esborrat com
a "altrament la migració falla" — **no adverteix que en Fase 5 aquestes files són dades reals de negoci**.

Amb D4 (sense feature flag) no hi ha marxa enrere barata. El disseny ja marcava això com a risc #5 i en
demanava un **dump/backup explícit com a pas obligatori del desplegament** — al codi no hi ha res que ho
imposi.

- **Recomanació:** afegir tiebreaker `, "id"` al `ORDER BY "createdAt"` (canvi trivial, evita
  no-determinisme quan els timestamps empaten).
- **DECISIÓ (12/08/2026):** **acceptat com a risc documentat, fora de l'sprint.** En executar la migració no
  existiran duplicats a la BBDD (les uniques encara hi són), així que la migració en si és segura.
  **Matís a no perdre:** l'exposició no és el moment de migrar, sinó un *rollback posterior* — un cop la
  Fase 5 estigui en producció i els tècnics ja hagin creat duplicats reals, revertir la migració els
  esborraria. Amb single-tenant i release coordinada s'assumeix; si mai cal revertir en producció, fer dump
  de `node_assignments` abans.

### R2 🟡 — `1782200000000` sense `name`; `1782700000000` `up()` no idempotent
Inconsistència menor amb la resta de migracions (deriven el `name` de la classe, funciona). El
`1782700000000-AddNodeAssignmentSegment.ts` `up()` (`:14`, `:33`) no té guards `IF NOT EXISTS`, així que un
reintent parcial falla. Preexistent, no d'aquesta feature. Inofensiu; deixar-ho documentat.

---

## 2. Incoherències (codi ↔ disseny/docs)

### R3 🟠 — Docs afirmen l'invariant que la Fase 5 va eliminar
- `CLAUDE.md:204` — "A person cannot hold two assignments in the same segment (unique `[segment, person]`)"
- `docs/PINYES_MODULE.md:97` — "una persona no pot aparèixer en dues instàncies del mateix segment"
- `docs/PINYES_MODULE.md:836` — "One person per segment"

Les tres són **falses** després de `DropNodeAssignmentDuplicateUniques`. El §9 del disseny ("Deute
documental") exigia explícitament actualitzar-les en implementar la Fase 5; no s'ha fet. Cal verificar
també `docs/DATA_MODEL.md` (uniques de `node_assignments`).

- **Recomanació:** actualitzar els tres punts + DATA_MODEL, substituint l'invariant per la nova regla
  (unicitat només per node; duplicats persona-segment legals i classificats). Regenerar seccions AUTO.
- **TANCAT (12/08/2026):** `CLAUDE.md`, `docs/PINYES_MODULE.md` (×2) actualitzats amb la regla real;
  `docs/DATA_MODEL.md` regenerat via `pnpm run docs:model`.

### R4 🟡 — Forat de prova (tancat): persones no confirmades no estaven cobertes al test d'equivalència D13
`event-participation.service.ts:162-171` vs `node-assignment.service.ts:680-683`

**Revisat el 12/08/2026, en planificar el tancament: la premissa original era falsa.** La CTE `participants`
(`:162-171`) fa un `UNION` de dues branques: persones amb assistència a `CONFIRMED_STATUSES`, **i** persones
amb `node_assignments` al segment — aquesta segona branca **no filtra per assistència**. Una persona `NO_VAIG`
o sense cap fila d'`Attendance` que tingui ≥2 col·locacions al segment ja apareixia a la matriu de
Participació i ja comptava a `conflictedPersons`/`conflictsByKind`, exactament igual que a
`getSegmentConflicts`. El frontend (`event-participation.component.ts`) tampoc filtra per assistència per
defecte (`statusFilter = null`). No hi havia divergència.

El que sí faltava era cobertura: `seedEveryKind()` al test d'equivalència D13 sembrava les cinc persones amb
`AttendanceStatus.ANIRE`, així que la branca del `UNION` que impedeix la divergència mai s'havia exercit.

- **Tancat:** `participation-conflicts-equivalence.integration.spec.ts` ara sembra dos segments nous — una
  persona `NO_VAIG` amb duplicat TRONC_TRONC, i una persona sense cap fila d'`Attendance` amb duplicat
  PINYA_PINYA — i asserta explícitament que totes dues apareixen amb `conflictSegmentIds` no buit. No s'ha
  tocat `CONFIRMED_STATUSES` ni `event-participation.service.ts`: cap canvi de comportament, només de
  cobertura.

### R5 🟡 — `freeCountForArea` (TRONC) més estricte que la regla §5.4 que documenta
`apps/dashboard/src/app/features/pinyes/services/assignment-state.service.ts:73-76`

El comentari diu "TRONC → `!assignedInTronc`", però el cos exclou primer qualsevol persona a
`localAssignedIds` (construït sobre **totes** les assignacions, sense filtrar per àrea). Una persona
col·locada només a pinya queda fora del recompte "N lliures" de la pestanya Troncs, contra §5.4 ("lliure =
no assignada a cap node de tronc"). Impacte baix: el `person-panel` bucketitza igual (la persona surt a "Ja
a la pinya d'este segment"), així capçalera i llista queden coherents. És incoherència codi↔regla, no
miscompte visible.

- **Recomanació:** fer el guard `localAssignedIds` area-scoped per TRONC, o corregir el comentari/§5.4
  perquè reflecteixi el comportament real (decidir quina de les dues és la intenció).

### R6 🟡 — Comentari estancat "closes in Fase 5" per l'impact de `move()`
`apps/dashboard/src/app/features/pinyes/services/segment-workspace-state.service.ts:335`

El comentari del `computeFreedPinyaNodeIds` client diu que la duplicació es tanca a la Fase 5 quan
`move()` retorni impact. `move()` **ja retorna** impact (Fase 5); només `unassign()` no. Actualitzar el
comentari perquè no enganyi qui el retiri.

- **TANCAT (12/08/2026), com a efecte d'R9:** `unassign()` ara retorna `TroncChangeImpact` i
  `computeFreedPinyaNodeIds`/`noteFreedPinyaNodesFromUnassign` del client s'han eliminat — el comentari
  desapareix amb el mètode.

### R7 🟡 — Llistes de zones a mà on el disseny demanava `areaForZone()`
`figure-instance.service.ts:311` (`zone === TRONC || zone === BASE`) i `segment-assignment-render.util.ts`
(`targetTabForZone`). El pas 6 de la Fase 0 demanava substituir-les per `areaForZone()`. `targetTabForZone`
és desviació deliberada (necessita BASE→null, que `areaForZone` no expressa; ja anotada al seguiment). El de
`figure-instance` és funcionalment equivalent però és una segona instància del mateix patró. Deute cosmètic.

---

## 3. Riscos futurs i coses no del tot cobertes

### R8 🟡 — `cordon` s'omple amb `renglaPosition`, no `ringLevel` — nom ambigu
`node-assignment.service.ts:714`, `available-persons.service.ts:204`

El camp `ConflictPlacement.cordon` es popula des de `renglaPosition`, mentre `ringLevel` és un altre camp
d'`InstanceNode` que no s'usa mai per `cordon`. El nom `cordon` és ambigu davant `ringLevel`.

- **DECISIÓ (12/08/2026):** **downgrade a 🟡 — no és un bug de comportament.** L'heurística de "deixar la de
  cordó més interior" només és un **suggeriment per defecte**; la decisió real de quina col·locació treure
  **la pren el tècnic** (D9), així que no cal afinar l'ordenació ni programar-la al detall. Feina restant
  mínima i opcional: renombrar/documentar el camp `cordon` per treure l'ambigüitat davant `ringLevel`.

### R9 🟠 — `computeFreedPinyaNodeIds`: duplicat client/servidor + no filtra visibilitat per cordons
Servidor `node-assignment.service.ts:489-501` i client `segment-workspace-state.service.ts:338-350`
calculen la mateixa regla. Avui equivalents, però: (a) han de mantenir-se sincronitzats a mà; (b) `reviewItems`
es popula des de l'`impact` del **servidor** en assign/swap però des de la regla del **client** en
unassign/move, així la llista "pinyes a revisar" la calcula codi diferent segons l'última mutació; (c) **cap
de les dues** aplica el filtre de visibilitat per `numberOfCordons`/mode (`isNodeVisibleByCordons`), així un
node de pinya buit i **amagat més enllà dels cordons** es mostra igualment com a "alliberat a revisar" al
banner.

- **Recomanació:** que `unassign()` retorni `TroncChangeImpact` (tanca el duplicat client) i que
  `computeFreedPinyaNodeIds` (servidor) apliqui el mateix filtre de cordons/mode que la resta del taller.
- **TANCAT (12/08/2026):** `isNodeVisibleByCordons` extret a `@muixer/shared` i aplicat a
  `computeFreedPinyaNodeIds` (servidor), `computeInstanceAreaSummary` i el client
  (`segment-workspace-state.service.ts`, dins `refreshInstance`). `unassign()` ara retorna
  `TroncChangeImpact`; el controller ja no fixa 204 (pot portar body). `computeFreedPinyaNodeIds` i
  `noteFreedPinyaNodesFromUnassign` del client eliminats — `pinyes-tab`/`troncs-tab` consumeixen
  `res.impact` via `noteTroncImpact`, com `assign`/`swap`. **Fora d'abast, anotat a part:** el `move()`
  entre segments (`figure-instance.service.ts`) ja retornava `impact` i cap component el consumeix.

### R10 🟡 — `computeFreedPinyaNodeIds` és per-instància, no per-segment
`node-assignment.service.ts:489`. Un canvi de tronc que buida nodes de pinya d'**altres figures** del mateix
segment no es reflecteix a l'impacte. Coherent amb la lectura literal de D11 (impacte de la figura tocada),
però pot infravalorar la "revisió" real. Confirmar que és el comportament volgut.

### R11 🟡 — `ConflictPlacement` es construeix inline a 3 llocs (DRY)
`classifySegmentConflicts`, `getSegmentMoveConflicts` i `available-persons.service.ts`, cadascun repetint el
fallback `'Sense plantilla'` i `cordon = renglaPosition`. Un helper compartit (`toConflictPlacement`)
evitaria que divergeixin (relacionat amb R8/R12).

### R12 🟡 — `figureName` sempre `'Sense plantilla'` al camí de `getEventAssignmentSummary`
`node-assignment.service.ts:707` vs la query de `:1039-1043` que **no carrega** `figureInstance.figureTemplate`.
Inofensiu avui (el summary només llegeix `assignmentId`/`figureInstanceId` dels placements), però trencaria
si una fase futura exposés `placements` per aquest camí. Ja anotat al seguiment; el deixo aquí per no perdre'l.

### R13 🟡 — Banner obsolet en `move` amb assign fallit
En un move via taller, si l'unassign interí té èxit però l'assign següent falla, el handler d'error restaura
l'snapshot local però no crida `reloadConflicts()` — l'estat del servidor ha canviat i `conflicts()` queda
estancat fins a la propera recàrrega. Aresta d'error, no del camí feliç.

### R14 🟡 — Undo de resolució/cross-swap pot fer 409 si el node alliberat s'ha reocupat
`conflict-resolution.service.ts` (`removeBatch`) i `performCrossSwap`: l'undo reassigna en un `forkJoin`; si
un node alliberat va ser reprès abans de desfer, tot el `forkJoin` falla i l'acció es reempeny. Recuperació
parcial acceptable, però és una aresta a conèixer.

---

## 4. Forats de prova

### R15 🟠 — El camí positiu del conflicte tou (Fase 5) no s'asserta al backend
`impact.newConflicts` només s'asserta **buit** (`node-assignment.service.spec.ts:524`). Cap test d'`assign()`/
`swap()` sembra un estat on `impact.newConflicts` torni **no buit** — precisament el nucli de la Fase 5 (un
duplicat reïx i torna com a conflicte tou en lloc d'un 409) no té asserció positiva a la capa de servei.

- **TANCAT (12/08/2026):** afegits tests d'`assign()` i `swap()` que sembren un duplicat real i asserten
  `newConflicts` no buit, amb `kind` i `placements` (ordre TRONC abans de PINYA).

### R16 🟠 — `fase-3.spec.ts`: dues assercions que passen en silenci
`fase-3.spec.ts:43` (`if (await troncsTab.count())`) i `:64` (`if (await peoplePill.count())`) tanquen les
**úniques** assercions de l'estil de conflicte a `tronc-view` i del tooltip de dotació per àrea. Si l'element
no hi és, el test passa verd sense assertar res — l'anti-patró que el propi seguiment marca com a lliçó.

- **TANCAT (12/08/2026):** els dos `if` substituïts per `expect(...).toBeVisible()` abans de l'asserció
  original. **Nota d'execució:** no s'ha pogut córrer la suite Playwright en viu — `nx serve api` entrava en
  un bucle de reinici per un problema d'infraestructura de l'entorn (aliàs de webpack cap a
  `dist/libs/shared/index.js`, preexistent i no relacionat amb aquest canvi). El canvi de codi és correcte
  per revisió estàtica; pendent d'una execució real quan els servidors dev estiguin sans.

### R17 🟠 — Cap Playwright per a la Fase 6
`apps/dashboard-e2e/src/segments-flexibility/` només té `fase-3/4/5`. Tota la vista de Participació (filtre
d'àrea, columna Tronc, mètriques de càrrega) té zero cobertura e2e (27 Vitest sí). Decisió d'abast ja presa
i justificada al seguiment; la recullo per si el pla la vol tancar.

### R18 🟡 — La lectura de completesa de BASE (§5.3) no està fixada per cap test
La meitat `areaForZone(BASE)===TRONC` sí té test; la meitat que el §5.3 subratlla — que les queries de
completesa/dotació mantenen **PINYA+BASE agrupats a propòsit i NO s'unifiquen** — només viu en un comentari.
Un futur "arreglar-ho unificant" trencaria la intenció sense fer fallar cap test.

### R19 🟡 — L'estil ambre de conflicte a canvas/tronc-node no es prova amb dades sembrades
`fase-3`/`fase-4` són "regressió zero-conflicte" (proven que la UI és invisible sense conflictes). Només
`fase-5` crea un duplicat real, i comprova banner/panell, no l'estil `.conflict` del canvas/tronc-node que la
Fase 3 havia de demostrar.

### R20 🟡 — Branca de conflicte del cross-swap no exercida
`performCrossSwap` als dos tabs té callback de conflicte (`execute`/`undo`); els specs cobreixen només el
cross-swap feliç, no la branca on la reassignació fa aflorar un conflicte.

---

## 5. Coses descartades / ajornades a Fase 7 que poden morder

### R21 🟠 — Sense lock per segment/figura: edició concurrent crea conflictes/curses no modelades
Només hi ha lock temporal per event. Si dos tècnics editen el mateix segment alhora (cas real: "primer
troncs, després pinyes" amb diverses persones treballant), poden crear duplicats i curses sense cap avís de
concurrència. El disseny ho descarta a propòsit (cap perfil/rol), però amb duplicats ara legals el cost d'una
cursa és més alt. No modelat.

- **DECISIÓ (12/08/2026):** **fora d'abast.** Colla single-tenant; s'accepta i es documenta, sense feina
  d'sprint.

### R22 🟡 — D12 (segments solapats) i "menys carregades primer" ajornats correctament
Descartats de la Fase 6 amb acord d'usuari (cap event té `startTime`/`endTime`; el segon calia ampliar
`/available-persons`). Quan s'implementin caldrà un helper d'overlap per `"HH:mm"` (no n'existeix cap) i
ampliar `EventParticipationSegment`. Anotat per completesa.

### R23 🟡 — DEBT F1 afecta els panells nous
~~`unassign()` sense `TroncChangeImpact` manté viu el duplicat client de R9.~~ **Tancat via R9
(12/08/2026).** Queda dempeus: el DEBT F1 (taller inusable per sota de 639px) afecta directament el
banner/panell de conflictes nous i el diàleg D8 en mòbil.

---

## 6. Resum per a la reunió de tancament

Decisions preses el 12/08/2026 (veure cada troballa):
- **R1** — acceptat com a risc documentat (només tiebreaker `id` opcional). Fora d'sprint.
- **R4** — revisat en planificar el tancament: la premissa era falsa (no hi havia divergència real).
  **Tancat només amb test de cobertura**, sense tocar `event-participation.service.ts`.
- **R8** — downgrade 🟡: el tècnic decideix; només renombrar/documentar `cordon`. Opcional.
- **R21** — fora d'abast.

| Entra al pla de tancament | Deute documentat, deixar per Fase 7 |
|---|---|
| R3 (docs desactualitzats), **R4** (cobertura D13 de no-confirmats), R9 (unassign retorna impact + filtre de cordons), R15 (asserció positiva del conflicte tou), R16 (arreglar anti-patró `fase-3.spec.ts`) | R1 (només tiebreaker), R2, R5, R7, R8, R10–R14, R17–R20, R22, R23 (parcial) |

**Estat (12/08/2026): les cinc tasques del pla de tancament estan implementades i provades** (R3, R4, R9,
R15, R16 — veure `TANCAT` a cada secció). R6 i la meitat d'R23 cauen com a efecte d'R9. Únic pendent:
executar la suite Playwright de R16 en viu (bloquejat per un problema d'infraestructura de l'entorn dev, no
del canvi de codi). La resta és deute latent sense urgència.

*Veïns: [[SEGMENTS_FLEXIBILITY]] · [[SEGMENTS_FLEXIBILITY_PLAN]] · [[PINYES_MODULE]] · [[DEBT]]*
