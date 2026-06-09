# Pinyes Refactor — Code Review

Revisió general del codi de les fases 1–4 del refactor pinyes.  
Branca: `clean/review-all-code` | Data: 2026-06-05.

> **Metodologia:** 7 angles de revisió independents (línia a línia, comportaments eliminats, traçat cross-file, reutilització, simplificació, eficiència, altitud), seguits d'una fase de verificació per a cada candidat. Només s'inclouen troballes CONFIRMED o PLAUSIBLE.

---

## Resum executiu

| # | Severitat | Àrea | Fitxer |
|---|-----------|------|--------|
| F1 | **Alta** | Correcció de domini | `node-assignment.service.ts:312` |
| F2 | **Alta** | Seguretat (lock bypass) | `node-assignment.service.ts:967` |
| F3 | **Alta** | Fiabilitat | `node-assignment.service.ts:897` |
| F4 | **Mitjana** | Eficiència (N×60 files) | `node-assignment.service.ts:516,735` |
| F5 | **Mitjana** | Eficiència (N×60 files) | `node-assignment.service.ts:646` |
| F6 | **Mitjana** | Mantenibilitat | `node-assignment.service.ts:396` |
| F7 | **Mitjana** | Tipus / Mantenibilitat | `projection.service.ts:134` |
| F8 | **Baixa** | Documentació desincronitzada | `node-assignment.service.ts` + CLAUDE.md |
| F9 | **Baixa** | Eficiència (N+1 en loop) | `node-assignment.service.ts:863` |
| F10 | **Baixa** | Disseny (duplicació) | `node-assignment.service.ts:482,704` |

---

## F1 — Alta: Una mateixa persona pot tenir dos nodes en el mateix FigureInstance

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:312`  
**Verificació:** CONFIRMED

### Problema

Tant el guard d'aplicació com el constraint de BD estan definits per la tupla `(figureInstance, person, compositionSlot)`:

```typescript
// entity: node-assignment.entity.ts
@Unique(['figureInstance', 'person', 'compositionSlot'])

// service: assign() — person conflict check
const personConflict = await this.assignmentRepository.findOne({
  where: {
    figureInstance: { id: instanceId },
    person: { id: dto.personId },
    ...(compositionSlot ? { compositionSlot: { id: compositionSlot.id } } : { compositionSlot: IsNull() }),
  },
});
```

Quan un `FigureInstance` és de tipus composició (té `compositionTemplate`), cada `assign()` porta un `compositionSlotId` diferent. Això significa que si la mateixa persona s'assigna al slot A i al slot B del **mateix** `FigureInstance`, cap dels dos guards ho bloqueja: el guard d'aplicació filtra per `compositionSlot = :slotId`, i el constraint de BD permet la tupla perquè el tercer element és diferent.

El check a nivell de segment (línies 334–345) captura duplicats **entre** instàncies diferents del segment, però no **dins** la mateixa instància entre slots.

### Escenari de falla

Una composició de 4 pilars té l'Arnau assignat al slot 1 (pilar A). L'operador, per error, l'assigna també al slot 2 (pilar B) del mateix `FigureInstance`. Ambdues assignacions es guarden sense error. La projecció mostra l'Arnau en dos llocs físicament impossibles.

### Solució suggerida

Eliminar `compositionSlot` de la clàusula del conflict check de persona: una persona hauria de ser única per `(figureInstance, person)` independentment del slot.

---

## F2 — Alta: `checkEventLock` retorna silenciosament per a instàncies inexistents

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:967`  
**Verificació:** CONFIRMED

### Problema

```typescript
private async checkEventLock(instanceId: string): Promise<void> {
  const lockDays = parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
  if (lockDays <= 0) return;

  const instance = await this.figureInstanceRepository.findOne({
    where: { id: instanceId },
    relations: ['segment', 'segment.event'],
  });
  if (!instance?.segment) return;   // ← retorn silenciós
  // ...
}
```

Quan la `findOne` retorna `null` (instància eliminada) o quan `instance.segment` és nul (instància òrfena), el mètode retorna sense fer cap comprovació del lock ni llençar cap excepció. Els cridants (`assign`, `unassign`, `swap`, `resetSnapshot`, `bulkImport`, `updateCordons`) invoquen `checkEventLock` com a **primer pas**, i si el lock es salta silenciosament, la resta de la lògica continua fins que el seu propi `findOne` llença un `NotFoundException`.

### Escenari de falla

1. Un `instanceId` vàlid per a un event blocat ja fa temps, però la instància té la relació `segment` corrupte o és òrfena. La petició passa el lock check sense error.
2. Dos clients fan `assign` concurrentment: el primer elimina la instància just quan el segon ha superat el `checkEventLock`. El segon troba `null` al seu propi `findOne` i llença `NotFoundException`, però el lock mai s'ha comprovat.

### Solució suggerida

```typescript
if (!instance) throw new NotFoundException(`FigureInstance ${instanceId} not found`);
if (!instance.segment?.event) throw new InternalServerErrorException('Instance has no segment/event');
```

---

## F3 — Alta: `catch {}` nu a `bulkImport` embolcalla tots els errors com a conflictes

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:897`  
**Verificació:** CONFIRMED

### Problema

```typescript
try {
  const detail = await this.assign(instanceId, { nodeId: targetNode.id, personId, ... });
  created.push(detail);
} catch {
  conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Could not create assignment' });
}
```

El bloc `catch` no captura el tipus d'error. Qualsevol excepció —fallo de BD, timeout de connexió, violació de constraint inesperada— produeix exactament el mateix resultat: l'assignació s'afegeix a `conflicts` amb la raó genèrica `'Could not create assignment'` i la funció retorna **HTTP 200**.

### Escenari de falla

La connexió a la BD s'interromp parcialment durant un import de 20 persones. Les assignacions 1–15 es creen correctament. Les assignacions 16–20 fallen amb `QueryFailedError`. El client rep `HTTP 200` amb 5 "conflictes" genèrics. No hi ha cap alerta, cap log d'error a nivell de servei, i el client pot reintentarà creure que eren conflictes legítims.

### Solució suggerida

Relanzar errors inesperats o almenys loguejar-los:
```typescript
} catch (err) {
  if (err instanceof ConflictException || err instanceof NotFoundException) {
    conflicts.push({ ... });
  } else {
    throw err; // o: this.logger.error(err); conflicts.push({ ..., reason: 'Internal error' });
  }
}
```

---

## F4 — Mitjana: `getHistory` i `getFamilyHistory` carreguen tots els nodes per comptar-los

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:516` i `:735`  
**Verificació:** CONFIRMED

### Problema

Ambdós mètodes fan `leftJoinAndSelect('fi.instanceNodes', 'inode')` en el QB de dades, que hidrata tots els camps de geometria (`x`, `y`, `z`, `width`, `height`, `color`, `climbPath`, `metadata`…) per a cada node de cada instància. L'únic ús al mapping és:

```typescript
totalNodes: instance.instanceNodes?.length ?? 0,
```

Per a 25 instàncies paginades × 60 nodes = **1.500 files extra** transferides des de Postgres per produir 25 enters.

Cal notar que el QB de `count` (correcció H3) ja omet correctament aquest join. La inconsistència és que el QB de dades el manté.

### Solució suggerida

Substituir `leftJoinAndSelect('fi.instanceNodes', 'inode')` per `loadRelationCountAndMap('totalNodes', 'fi.instanceNodes')` o una subquery escalar `COUNT(*)`.

---

## F5 — Mitjana: `getEventAssignmentSummary` carrega tots els nodes per comptar-los

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:646`  
**Verificació:** CONFIRMED

### Problema

Idèntic a F4 però en `getEventAssignmentSummary`. Les `relations: [..., 'instanceNodes']` carreguen totes les dades de geometria de tots els nodes de totes les instàncies de tots els segments de l'event:

```typescript
const allInstances = await this.figureInstanceRepository.find({
  where: { segment: { id: In(segmentIds) } },
  relations: [
    'segment', 'figureTemplate', 'figureTemplate.family',
    'instanceNodes',          // ← carrega tota la geometria
    'assignments', 'assignments.instanceNode', 'assignments.person',
  ],
});
// ...
totalNodes: fi.instanceNodes?.length ?? 0,  // únic ús
```

Per a un event de 6 segments × 5 figures × 60 nodes: **1.800 objectes `InstanceNode`** carregats per produir 30 enters.

---

## F6 — Mitjana: Variables mortes `nodeIdA`/`nodeIdB` a `swap()`

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:396`  
**Verificació:** PLAUSIBLE

### Problema

```typescript
const nodeIdA = assignmentA.instanceNode.id;
const nodeIdB = assignmentB.instanceNode.id;

await this.dataSource.query(
  `UPDATE node_assignments SET "personId" = CASE
     WHEN id = $1::uuid THEN $2::uuid
     WHEN id = $3::uuid THEN $4::uuid
   END WHERE id IN ($1::uuid, $3::uuid)`,
  [dto.assignmentIdA, assignmentB.person.id, dto.assignmentIdB, assignmentA.person.id],
);
```

`nodeIdA` i `nodeIdB` es calculen però mai s'usen. El SQL només intercanvia `personId` (no els nodes). Això suggereix que el `swap` original havia d'intercanviar nodes, però la implementació final intercanvia persones. Les variables mortes indueixen a error qualsevol lector que assumeixi que el swap és bidireccional sobre nodes i persones.

A més, la validació de pertinença (línia 389) verifica que `assignmentA.figureInstance.id === instanceId` però el SQL `WHERE id IN ($1, $3)` no filtra per `figureInstanceId` —si els `assignmentId` enviats pertanyen a instàncies diferents, el SQL els actualitzaria igualment.

---

## F7 — Mitjana: `Person` no importat a `projection.service.ts`

**Fitxer:** `apps/api/src/modules/event-segment/projection.service.ts:134`  
**Verificació:** CONFIRMED

### Problema

`projection.service.ts` no importa l'entitat `Person`. Les propietats de persona s'accedeixen via `as any`:

```typescript
person: {
  id: a.person.id,
  alias: (a.person as any).alias,
  name: (a.person as any).name,
  firstSurname: (a.person as any).firstSurname,
  shoulderHeight: (a.person as any).shoulderHeight ?? null,
},
```

A `node-assignment.service.ts` el patró correcte ja existeix: `(assignment.person as Person).alias`. El `as any` a `projection.service.ts` desactiva la comprovació de tipus per a tots els camps de persona: un reanomenament de camp (`firstSurname` → `lastName`) compilaria sense error però fallaria en runtime.

### Solució suggerida

Afegir `import { Person } from '../person/person.entity';` i substituir els `as any` per `(a.person as Person)`.

---

## F8 — Baixa: `upgradeInstance` eliminat però columnes i documentació el continuen referenciant

**Fitxers:** `instance-node.entity.ts:48`, `figure-instance.entity.ts:52`, `CLAUDE.md:56-58`  
**Verificació:** CONFIRMED (comportament eliminat, no restablert)

### Problema

El tracking doc (DC11) marca `POST /instances/:id/upgrade` com eliminat. El controller i el service han perdut el mètode. Però:

1. `FigureInstance.sourceVariantOrder` té el comentari "Used by the upgrade operation to find which variant's nodes to add next."
2. `InstanceNode.originNodeId` té el comentari "Used for upgrade matching: canonical ID = originNodeId ?? sourceNodeId."
3. **`CLAUDE.md` documenta l'upgrade com a pas 4 del cicle de vida actiu** (lín. 56–58): *"POST /instances/:id/upgrade adds new InstanceNodes from the next variant without touching existing ones."*

Les columnes es continuen escrivint al snapshot però cap endpoint les llegeix per fer res. Si l'eliminació és definitiva, els comentaris i el CLAUDE.md cal actualitzar-los. Si era temporal, cal documentar la decisió.

---

## F9 — Baixa: `bulkImport` fa N checks de conflicte redundants abans de cridar `assign()`

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:863`  
**Verificació:** PLAUSIBLE

### Problema

El bucle de `bulkImport` fa 3 checks de conflicte per cada assignació (lines 863–888):
1. `findOne` node ocupat
2. `findOne` persona ja en instància
3. `createQueryBuilder` persona ja en segment

Després crida `this.assign()` (línia 891), que internament **repeteix els mateixos 3 checks** (línies 308–345) a més de `checkEventLock` (2 queries) i el reload post-save.

Per a un import de 20 persones: fins a **(3 + 8) × 20 = ~220 queries** en sèrie. Els checks previs existeixen per produir millors missatges de conflicte, però generen una sobrecàrrega de 3× per a cada assignació exitosa.

---

## F10 — Baixa: `getHistory` i `getFamilyHistory` dupliquen el patró H3

**Fitxer:** `apps/api/src/modules/node-assignment/node-assignment.service.ts:482` i `:704`  
**Verificació:** CONFIRMED (per inspecció directa)

### Problema

Ambdós mètodes contenen exactament el mateix patró: paginació, doble QB (count sense joins + data amb joins), filtre `seasonId`, `orderBy('ev.date', 'DESC')`, mapping idèntic a `FigureHistoryEntry[]`. L'única diferència és la clàusula `WHERE`:

- `getHistory`: `fi.figureTemplateId = :templateId`
- `getFamilyHistory`: `tpl.familyId = :familyId` (amb un join addicional sobre `figureTemplate`)

Qualsevol correcció futura (e.g., la correcció F4 sobre `instanceNodes`) ha d'aplicar-se dues vegades. Si s'aplica a un i s'oblida l'altre, el comportament de paginació per família i per plantilla serà inconsistent.

---

## Troballes desestimades

| Candidat | Decisió | Raó |
|----------|---------|-----|
| `projection.service.ts:76` — nodes sempre buits | REFUTED | TypeORM sí hidrata `figureInstanceId` com a columna raw FK fins i tot sense carregar la relació. El fallback `(node as any).figureInstanceId` funciona. |
| `composition-template.service.ts:306` — null deref en `figureTemplate` | REFUTED | `CompositionSlot.figureTemplate` té `onDelete: 'RESTRICT'` que impedeix eliminar una `FigureTemplate` referenciada. El precondici mai es compleix. |
| `rengla.entity.ts` — BC1 mancant `updatedAt` | REFUTED | `@UpdateDateColumn() updatedAt` present al fitxer. BC1 aplicat correctament. |
| `instance-node.entity.ts` — BC2 mancant `updatedAt` | REFUTED | Columna present. BC2 aplicat. |

---

## Prioritat d'acció

**Urgents (afecten correctesa o fiabilitat en producció):**
- [x] F1 — Unicitat persona per instància independent del slot
- [x] F2 — `checkEventLock` ha de llençar excepció, no retornar silenciosament
- [x] F3 — `catch {}` de `bulkImport` ha de relanzar errors inesperats

**Importants (rendiment mesurable):**
- [x] F4 — `getHistory`/`getFamilyHistory`: substituir join per `loadRelationCountAndMap`
- [x] F5 — `getEventAssignmentSummary`: substituir join per count escalar

**Neteja (baixa urgència):**
- [x] F6 — Eliminar variables mortes `nodeIdA`/`nodeIdB` de `swap()`
- [x] F7 — Importar `Person` a `projection.service.ts` i eliminar `as any`
- [x] F8 — Actualitzar CLAUDE.md i comentaris d'entitats sobre `upgradeInstance`
- [x] F9 — Refactoritzar `bulkImport` per eliminar el doble check de conflicte
- [x] F10 — Extreure helper privat compartit per `getHistory`/`getFamilyHistory`
