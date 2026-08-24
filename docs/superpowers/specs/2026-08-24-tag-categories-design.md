---
tags: [domini]
---

# Categories d'etiquetes, filtres i millores de Participació

Data: 2026-08-24 · Branca: `imp-feat/millores-etiquetes-i-participació`

## Objectiu

Les etiquetes de persona (`Tag`, taula legacy `positions`) no tenen cap agrupació. Volem
dividir-les en **categories** (ara `TRONC` i `PINYA`, amb espai per a `ALTRES`) i aprofitar-ho per a:

1. Filtrar per categoria al llistat de Persones, al panell d'assignació de pinyes i a la
   pestanya Participació d'un event.
2. Afegir columnes noves a Participació: etiquetes de Tronc i de Pinya separades, alçada
   d'espatlla i (només en assaigs) l'estat d'assistència a la pròxima actuació.
3. Assignar etiquetes més ràpid: nova pàgina de detall d'etiqueta amb la llista de persones
   relacionades i afegir/treure persones des d'allí.

No és un canvi de model dràstic: una columna nova a `positions`, cap taula nova.

## Decisions de disseny

### Categoria com a enum a `Tag`

`TagCategory` a `@muixer/shared`: `TRONC` | `PINYA` | `ALTRES`. Columna `category`
`varchar` **not null**, sense default a nivell de codi (el formulari obliga a triar-la).

Alternativa descartada: derivar la categoria de `Tag.positionTypes`. És possible
(`TRONC_NODE_PRESETS` vs `PINYA_NODE_PRESETS`) però una etiqueta pot barrejar
`positionTypes` de tronc i de pinya, i no deixaria lloc a `ALTRES`. `positionTypes`
s'usa **només** per fer el backfill de la migració.

Relació amb `positionTypes`: al formulari d'etiqueta, els grups de `positionTypes`
seleccionables es filtren per la categoria triada (TRONC → presets de tronc + direccions +
base; PINYA → presets de pinya; ALTRES → cap grup, es desa buit). En canviar de categoria
s'esborren els `positionTypes` incompatibles.

### Dades que ha d'exposar l'API

`category` s'afegeix a totes les projeccions d'etiqueta que el front ja consumeix:

- `PositionResponseDto` (`apps/api/src/modules/person/dto/person-response.dto.ts:4-19`):
  afegir `category` i `positionTypes`; **eliminar `zone`** (la columna es va esborrar a la
  migració `1782000000000` i el DTO encara la declara).
- `AvailablePersonPosition` (`libs/shared/src/interfaces/pinyes/assignment.interfaces.ts:64`).
- `EventParticipationPersonPosition`
  (`libs/shared/src/interfaces/pinyes/event-participation.interfaces.ts:58-64`).
- Model dashboard `TagWithCount` / `Position`
  (`apps/dashboard/src/app/features/config/models/tag.model.ts`,
  `apps/dashboard/src/app/features/persons/models/person.model.ts:3`).

Fora d'abast (deute existent, s'anota a `docs/DEBT.md`): unificar el model `Tag` duplicat
al dashboard dins `libs/shared` i centralitzar les etiquetes de `positionTypes`, avui
re-derivades a `tags-list.component.ts:46-54` i `tag-form-modal.component.ts:60-89`.

### Filtres

| On | Paràmetre | Implementació |
|----|-----------|---------------|
| `GET /tags` | `category?: TagCategory[]` | Primer `TagFilterDto` del mòdul (avui `findAll` no accepta query). Manté la resposta actual (array amb `personCount`), no s'introdueix paginació. |
| `GET /persons` | `positionCategory?: TagCategory[]` | A `PersonFilterDto`, amb el mateix `@Transform` que `positionIds`. Al `person.service.findAll` una subconsulta germana de la de `positionIds` (`:66-78`), sobre `sub_position.category`. Combinades amb **AND** entre elles i OR dins de cada una. |
| `GET .../available-persons` | `positionCategory?: TagCategory` | Un sol valor, al costat del `positionId` existent (`available-persons-query.dto.ts:33`, subconsulta a `available-persons.service.ts:113-125`). |
| Participació | — | Filtre client, les dades ja hi són (`availablePositions` es deriva de la població carregada, `event-participation.component.ts:137-143`). |

UI:

- **Persones**: un multi-select «Categoria» nou al `filter-bar`, i el selector d'etiquetes
  existent agrupa les opcions per categoria. Triar categories no altera la selecció
  d'etiquetes; són dos filtres independents que el servidor combina amb AND.
- **Panell d'assignació de pinyes** (`person-panel.component.ts`): xips de categoria
  Tronc/Pinya sobre el desplegable d'etiquetes. En seleccionar un node s'hi
  **pre-selecciona** la categoria segons la zona del node (zona TRONC/BASE → `TRONC`,
  PINYA → `PINYA`, direccions/decoració → cap), i l'usuari la pot netejar. El desplegable
  d'etiquetes mostra només les de la categoria activa. Es manté l'ordenació actual per
  `positionType` coincident (`sortByPosition`, :219-227).
- **Participació**: xip de filtre «Categoria», germà del d'«Etiqueta» ja existent.

### Columnes noves a Participació

Sobre `event-participation.component.ts:260ff` i
`apps/api/src/modules/node-assignment/event-participation.service.ts`:

1. `tagsTronc` i `tagsPinya` substitueixen la columna única `tags` (:287-292). Mateix tipus
   `colorBadges`, cada una filtrant `row.positions` per categoria. Les etiquetes `ALTRES`
   no es mostren en cap de les dues columnes (visibles al detall de la persona).
2. `shoulderHeight`: `Person.shoulderHeight` (cm, nullable) afegit a la Q1 del servei i a
   `EventParticipationPersonRow`. Es mostra en **relatiu** respecte
   `SHOULDER_HEIGHT_BASELINE_CM` (140), igual que ho fa el panell de pinyes
   (`person-panel.component.ts:565-568`); `null` i `0` es mostren com a `-`. Nou valor de
   `SortField` per poder ordenar-hi.
3. `nextPerformanceStatus`: només quan l'event visualitzat és un **ASSAIG**. El servidor
   resol la primera `ACTUACIO` de la mateixa temporada amb data posterior a la de l'event
   actual i, per a cada persona de la població, hi adjunta el seu `AttendanceStatus`
   (o `PENDENT` si no hi ha registre). La meta de la resposta guanya
   `nextPerformance: { id, name, date } | null`; la capçalera de la columna mostra la data
   d'aquella actuació. Si no hi ha actuació futura, ni meta ni columna.

Cap d'aquestes columnes trenca el mode targeta del `data-table`: la columna `person` es
manté com a `primary`.

### Assignació de persones des de les etiquetes

**Decisió: pàgina de detall** `/config/tags/:id` (`TagDetailComponent`), no modal. Motiu:
volem veure *i* gestionar la llista de persones relacionades, i una llista amb cerca i
paginació no cap bé en un modal; la pàgina també és enllaçable. La fila del llistat
d'etiquetes hi navega, i l'acció «Edita» del llistat continua obrint el modal actual.

Contingut de la pàgina:

- Capçalera amb nom, color, categoria, `positionTypes` i `personCount`, més botó «Edita»
  que reobre `TagFormModalComponent`.
- `app-data-table` amb les persones que tenen l'etiqueta, obtingudes reutilitzant
  `GET /persons?positionIds=<id>` (cap endpoint de lectura nou).
- Afegir: `person-search-input` + botó, que exclou les persones ja presents.
- Treure: acció per fila amb confirmació.

Endpoints nous (mutació del join `person_positions`, al `TagController`):

```
POST   /tags/:id/persons        { personIds: string[] }   → 204
DELETE /tags/:id/persons/:personId                        → 204
```

Es fa així, i no amb `PATCH /persons/:id { positionIds }`, perquè aquell camí obliga a un
read-modify-write per persona i perd assignacions si dues pestanyes editen la mateixa
persona. Les dues operacions són idempotents. 404 si l'etiqueta o la persona no existeixen.

## Fases d'implementació

Cada fase és desplegable per si sola i deixa l'app coherent.

### Fase 1 — Model i CRUD d'etiquetes

- `TagCategory` a `libs/shared` (enum + export a l'índex).
- `Tag.category` a l'entitat + migració: afegir la columna nullable, backfill
  (`positionTypes` ⊆ presets de pinya → `PINYA`; ⊆ tronc/direccions/base → `TRONC`; buit o
  barrejat → `ALTRES`), i finalment `SET NOT NULL`.
- `CreateTagDto.category` obligatori (`@IsEnum`), `UpdateTagDto` l'hereta.
- `PositionResponseDto`: `+category`, `+positionTypes`, `-zone`.
- Formulari d'etiqueta: selector de categoria + grups de `positionTypes` filtrats per
  categoria; llistat d'etiquetes agrupat o amb badge de categoria.
- Tests: servei de tags (create/update amb categoria), migració via test d'integració,
  spec del formulari (canvi de categoria neteja `positionTypes` incompatibles).

### Fase 2 — Filtres per categoria

- `TagFilterDto` + `findAll(filter)` a `tag.service`.
- `PersonFilterDto.positionCategory` + subconsulta a `person.service.findAll`.
- UI del llistat de Persones: filtre «Categoria», etiquetes agrupades per categoria, xip de
  filtre actiu i neteja.
- Tests: spec del servei de persones (categoria sola, categoria + `positionIds`), spec del
  llistat per als xips i la query emesa.

### Fase 3 — Assignació de pinyes

- `positionCategory` a `AvailablePersonsQueryDto` + subconsulta al servei.
- `person-panel`: xips de categoria, pre-selecció segons la zona del node actiu, filtratge
  del desplegable d'etiquetes.
- Tests: spec del servei (filtre per categoria) i del panell (pre-selecció per zona,
  neteja manual).

### Fase 4 — Columnes de Participació

- Servei: `shoulderHeight` a la Q1; resolució de la pròxima `ACTUACIO` i els seus estats
  d'assistència; ampliació de les interfícies de fila i meta a `libs/shared`.
- Component: columnes `tagsTronc`, `tagsPinya`, `shoulderHeight` (ordenable),
  `nextPerformanceStatus` (condicional a `ASSAIG`), filtre de categoria.
- Tests: spec del servei (pròxima actuació dins la temporada, cap actuació futura, persona
  sense registre → `PENDENT`) i del component (columnes condicionals, alçada relativa).

### Fase 5 — Detall d'etiqueta

- `POST /tags/:id/persons`, `DELETE /tags/:id/persons/:personId` (+ Swagger, `AuditLog`
  com la resta de mutacions sensibles del mòdul).
- Ruta `config/tags/:id` i `TagDetailComponent` amb taula, cerca de persones i esborrat de
  la relació; navegació des del llistat.
- Tests: spec del servei (afegir idempotent, treure inexistent, 404), spec del component.

### Tancament

`pnpm run docs:model` (canvi d'entitat) i `pnpm run docs:map` si s'afegeixen fitxers de
feature; actualitzar la fila del mòdul `tag` a `CLAUDE.md` i la de Participació a
`docs/PINYES_MODULE.md`.

## Riscos

- **Backfill ambigu**: etiquetes amb `positionTypes` barrejats cauen a `ALTRES` i cal
  reclassificar-les a mà. És visible al llistat (badge de categoria), no silenciós.
- **`zone` al DTO**: eliminar-la és correcte però el front pot llegir-la en algun lloc; cal
  fer un `grep` de `\.zone` sobre els models de persona/etiqueta abans de traure-la.
- **Cost de la pròxima actuació**: una consulta extra per event de tipus assaig. És una sola
  query d'assistència filtrada per event, del mateix ordre que les Q1–Q3 actuals.

*Veïns: [[PINYES_MODULE]] · [[DATA_MODEL]] · [[DASHBOARD_UI]]*
