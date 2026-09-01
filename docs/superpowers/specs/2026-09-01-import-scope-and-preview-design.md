---
tags: [domini]
---

# Importació per àmbit (pinya / tronc / figura) amb previsualització

**Date:** 2026-09-01
**Status:** Approved
**Tags:** domini, pinyes

> Aquest document absorbeix i substitueix l'esborrany `2026-09-01-import-pinya-preview-design.md` (previsualització d'importació), que s'ha eliminat.

## Problema

Dos problemes que comparteixen el mateix modal:

1. **L'import és tot o res.** `bulkImport()` copia totes les assignacions de la instància origen (pinya, tronc, base, direccions, decoració). Els tècnics de pinya i de tronc són persones diferents que treballen sobre parts diferents de la mateixa figura: qui prepara els troncs no vol arrossegar la pinya d'un assaig anterior, i a l'inrevés. Alhora, cal poder importar-ho tot d'un cop quan una sola persona munta la figura sencera.
2. **No es veu què s'importa.** El modal mostra només un resum de text de fins a 5 parelles node→persona. Sense comprensió espacial, s'importa el que no toca i s'ha de desfer a mà.

## Solució

Afegir un **àmbit d'importació** (`ImportScope`) al `bulkImport` i, al modal, oferir tres accions sobre l'entrada d'històric seleccionada — **Importa pinya**, **Importa tronc**, **Importa figura** — cadascuna amb **Previsualitza** al costat. La previsualització mostra només l'àmbit corresponent, de manera que el tècnic veu exactament el que entrarà.

### Flux d'usuari

```
1. El tècnic obre el modal des del botó «Importa figura» (pinyes-tab)
2. Tria una figura de l'històric
3. Apareixen tres files d'acció amb el nombre d'assignacions de cada àmbit
4. (Opcional) Previsualitza l'àmbit que l'interessa
5. Importa aquell àmbit
```

## Decisions

| Decisió | Valor |
|---|---|
| Zones de l'àmbit `PINYA` | `PINYA` |
| Zones de l'àmbit `TRONC` | `TRONC`, `BASE` |
| Zones de l'àmbit `ALL` | totes (comportament actual) |
| Direccions i decoració | només amb `ALL` |
| Assignacions ja existents al destí | no se sobreescriuen; conflicte i omissió, com ara |
| Nodes ad-hoc | es cloen **sempre**, sense filtre d'àmbit |
| Punt d'entrada | el botó actual de `pinyes-tab`, amb el label canviat a «Importa figura» |
| Selectors desplegables | cap |

Les zones `BASE` van amb el tronc perquè els nodes de base pertanyen conceptualment al muntatge del tronc, no al de la pinya.

Els nodes ad-hoc es cloen sempre, amb les seves assignacions, independentment de l'àmbit triat. És reutilitzar la funcionalitat existent tal com és; si en sobren, el tècnic els esborra després d'importar. Conseqüència visible: importar només la pinya pot portar nodes ad-hoc de tronc. El toast ja ho diu («S'han clonat N nodes manuals»).

## Canvis al backend

### B1. Enum `ImportScope`

Nou a `libs/shared/src/enums/`, exportat des de `@muixer/shared`:

```typescript
export enum ImportScope {
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  ALL = 'ALL',
}
```

### B2. DTO

`apps/api/src/modules/node-assignment/dto/bulk-import-assignment.dto.ts`:

```typescript
@IsOptional()
@IsEnum(ImportScope)
scope?: ImportScope;
```

Opcional amb defecte `ALL`: els clients que no l'enviïn conserven el comportament actual.

### B3. `bulkImport()` filtra per zona

`apps/api/src/modules/node-assignment/node-assignment.service.ts` (~línia 1239).

Derivar un conjunt de zones de l'àmbit i saltar les assignacions d'origen fora del conjunt, dins del bucle sobre `sourceAssignments` i just després del `continue` que ja salta els nodes ad-hoc:

```typescript
const zones = zonesForScope(dto.scope ?? ImportScope.ALL); // null quan ALL
...
if (sourceNode.isAdHoc) continue;           // ja existent
if (zones && !zones.has(sourceNode.zone)) continue;  // NOU
```

Res més canvia: `checkEventLock`, l'auto-snapshot del destí, el matching per `renglaId:renglaPosition` amb fallback a `sourceNodeId`, la classificació d'errors i la forma de `BulkImportResult` queden igual. El bloc de clonatge de nodes ad-hoc **no es toca**.

### B4. Històric enriquit

`getHistory()` ja fa `leftJoinAndSelect` de `a.instanceNode` i de `fi.segment`, així que els dos camps nous no costen cap consulta:

- `segmentId: instance.segment.id` a l'arrel de l'entrada — necessari per demanar la projecció de la previsualització.
- `zone: a.instanceNode.zone` a cada element de `assignments[]` — el modal en calcula els comptadors per àmbit al client.

Mirall del tipus a `libs/shared/src/interfaces/pinyes/assignment.interfaces.ts` (`FigureHistoryEntry`) i a `libs/pinyes-render/src/lib/models/assignment.model.ts`.

## Canvis al frontend

### F1. Botó de `pinyes-tab`

`pinyes-tab.component.html`: label «Importa pinya» → «Importa figura», i `aria-label` «Importa les assignacions d'una figura anterior». Sense canvis de comportament ni un segon punt d'entrada a `troncs-tab`.

### F2. `ImportPinyaModalComponent` — tres accions

Quan hi ha `selectedEntry()`, substituir el botó únic d'importar per tres files:

```
Pinya    12 assignacions   [ Previsualitza ]  [ Importa ]
Tronc     5 assignacions   [ Previsualitza ]  [ Importa ]
Figura   17 assignacions   [ Previsualitza ]  [ Importa ]
```

- Comptadors: `computed()` que agrupa `selectedEntry().assignments` per `zone` segons el mapeig d'àmbits.
- Una fila amb 0 assignacions queda desactivada.
- `doImport(scope: ImportScope)` passa l'àmbit a `NodeAssignmentService.bulkImport()`.
- El resum de text existent i el toast de `onImportCompleted()` no canvien.

### F3. `ImportPreviewModalComponent` (nou)

`apps/dashboard/src/app/features/pinyes/components/import-preview-modal/`.

Overlay per sobre del modal d'importació. Inputs: `eventId`, `segmentId`, `instanceId`, `scope`, `eventTitle`, `open`. Output: `closed`. Obté les dades amb `ProjectionService.getProjection(eventId, segmentId)`; spinner mentre carrega, alerta d'error si falla; es tanca amb backdrop, Escape o el botó de tancar.

Render segons l'àmbit:

- `ALL` i `PINYA` → `<lib-pinya-projection [data] [instanceId] [scope]>`, amb un input `scope` nou al component que filtra els nodes del canvas i, quan és `PINYA`, amaga els panells de tronc.
- `TRONC` → `<lib-tronc-view mode="projection">` directament, amb els nodes de tronc, base i direcció de la instància.

El cas `TRONC` no passa per `lib-pinya-projection` perquè els panells de tronc s'ancoren a la geometria del canvas de pinya (`figure-placement`); amb la pinya buida la col·locació no té sentit. `lib-tronc-view` ja accepta exactament els inputs necessaris.

## Resum de fitxers

| Fitxer | Canvi |
|---|---|
| `libs/shared/src/enums/import-scope.enum.ts` (nou) | Enum `ImportScope` |
| `libs/shared/src/interfaces/pinyes/assignment.interfaces.ts` | `segmentId` + `zone` a `FigureHistoryEntry` |
| `libs/pinyes-render/src/lib/models/assignment.model.ts` | Mirall dels dos camps |
| `apps/api/.../dto/bulk-import-assignment.dto.ts` | Camp `scope` opcional |
| `apps/api/.../node-assignment.service.ts` | Filtre de zona a `bulkImport()`; `segmentId` i `zone` a `getHistory()` |
| `apps/dashboard/.../pinyes-tab.component.html` | Label del botó |
| `apps/dashboard/.../import-pinya-modal.component.{ts,html}` | Comptadors per àmbit, tres accions, botons de previsualització |
| `apps/dashboard/.../import-preview-modal.component.{ts,html}` (nou) | Overlay de previsualització |
| `apps/dashboard/.../services/node-assignment.service.ts` | `scope` al cos de `bulkImport` |
| `libs/pinyes-render/.../pinya-projection.component.{ts,html}` | Input `scope` |

## Tests

**API (Jest)**
- `bulkImport` amb `PINYA` importa nodes de pinya i cap de tronc ni de base.
- `bulkImport` amb `TRONC` importa tronc i base, cap de pinya.
- `bulkImport` amb `ALL` i sense `scope` es comporten igual que avui.
- Els nodes ad-hoc es cloen amb qualsevol àmbit.
- `getHistory` retorna `segmentId` i la `zone` de cada assignació.

**Dashboard (Vitest)**
- Els comptadors per àmbit surten de les zones de l'entrada seleccionada.
- Una fila amb 0 assignacions queda desactivada.
- Cada botó d'importar crida el servei amb el seu `scope`.
- `ImportPreviewModalComponent`: càrrega correcta, estat d'error, i tria del render segons l'àmbit.

## Casos límit

1. **La figura origen no té tronc** — la fila «Tronc» surt amb 0 i desactivada.
2. **La figura origen no té pinya** — igual per a la fila «Pinya».
3. **Instància origen no snapshotted** — no seleccionable, com ara.
4. **La projecció falla** — alerta dins de la previsualització; es tanca i es pot reintentar.
5. **El segment té diverses instàncies** — `[instanceId]` filtra el render a la seleccionada.
6. **Figures grans** — `applyReadonlyFit()` ja escala al contenidor.

## Fora d'abast

- Substituir les assignacions existents del destí (l'àmbit s'afegeix, no reemplaça).
- Vista de diferències entre l'origen i l'estat actual del destí.
- Un segon punt d'entrada a `troncs-tab`.
- Importació per àmbit d'instàncies basades en composició (el modal ja filtra a instàncies de plantilla).
- Filtrar els nodes ad-hoc per àmbit.

---

*Veïns: [[PINYES_MODULE]], [[DESIGN_SYSTEM]], [[DATA_MODEL]]*
