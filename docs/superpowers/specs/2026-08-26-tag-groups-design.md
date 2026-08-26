---
tags: [domini]
---

# Grups d'etiquetes, regla mínima i catàleg definitiu

Data: 2026-08-26

## Objectiu

L'equip tècnic —usuari principal del Dashboard— ha definit com vol treballar amb les
etiquetes de persona: quatre **grups** d'etiquetes, un catàleg concret d'etiquetes dins de
cada grup, una **regla mínima** de completesa per persona i dues **visualitzacions** segons
si es prepara el guió o es preparen les pinyes.

Aquest document ajusta el sistema actual a eixa especificació sense canviar el model de
dades més enllà d'un valor nou d'enum, desconnecta la importació d'etiquetes que ve de
l'App legacy i substitueix el catàleg importat pel definitiu.

## Punt de partida: com funcionen les etiquetes avui

Cal tenir-ho present perquè el disseny s'hi recolza deliberadament.

**Model.** `Tag` és una fila de la taula `positions` (`apps/api/src/modules/tag/tag.entity.ts`):
`name`, `slug`, `shortDescription`, `longDescription`, `color`, `positionTypes: text[]` i
`category` (`TRONC | PINYA | ALTRES`). La relació amb `Person` és M:N a través de
`person_positions` (`person.entity.ts:82`). No hi ha cap restricció: una persona pot tindre
zero, una o vint etiquetes de qualsevol categoria.

**Integritat feble amb les posicions de les figures.** Els nodes de plantilla i d'instància
(`FigureNode.positionType`, `InstanceNode.positionType`) guarden un string tret dels presets
de `libs/shared/src/constants/node-preset.constants.ts`: tronc (`segona`, `terça`, `quarta`,
`quinta`, `sisena`, `puntal`, `alçadora`, `xiqueta`), pinya (`agulla`, `mans`, `laterals`,
`vents`, `cordo-obert`, `tap`, `crossa`, `contrafort`, `comodin`), direccions
(`direccio-figura`, `direccio-xicalla`), decoració i el valor solt `base`.

`Tag.positionTypes` és **només una llista de pistes** cap a eixos strings. No hi ha clau
forana, ningú valida que els valors existisquen i **no bloqueja cap assignació**: qualsevol
persona es pot assignar a qualsevol node. El seu efecte real és:

- ordenar candidats al panell de persones: qui té una etiqueta amb el `positionType` del node
  seleccionat puja amunt (`person-panel.component.ts:228-236`, només a les llistes de
  confirmats i de no-shows);
- pintar el punt de color de coincidència a la fitxa i a la targeta hover
  (`person-panel.component.html:270`, `person-hover-card.component.ts:77-88`).

Cap filtre del servidor usa `positionTypes`: al payload viatja, però `available-persons` i el
llistat de persones filtren per `positionId` (etiqueta concreta) o per `positionCategory`
(`available-persons.service.ts:117-133`, `person.service.ts:82`, tots dos a través de
`applyPositionCategoryFilter`).

**Aquesta feblesa és una funcionalitat, no un defecte**, i el disseny la manté: és
exactament el que permet que «Mans», «Vent» i «Segon Cordó» apunten als mateixos
`positionTypes` sense que el model haja de saber què és una primera i què és una segona.

**Import legacy.** `person-sync.strategy.ts:20-34` té una taula `POSITION_MAPPING` amb dotze
claus legacy (PRIMERES, VENTS, LATERALS, CONTRAFORTS, 2NS LATERALS, CROSSES, CANALLA,
NENS COLLA, ACOMPANYANTS, ALTRES, NOVATOS, IMATGE I PARADETA). A cada sync es creen o
s'**sobreescriuen** les etiquetes per `slug` (`upsertPosition`, `:384-411`) i les persones
reben les seues etiquetes **només al CREATE** (`createPerson:443`), mai a l'UPDATE. El
boolean `Person.isXicalla` es deriva de les claus CANALLA / NENS COLLA, també només al
create.

## Decisions de disseny

### 1. El grup és la categoria: `TagCategory` passa a quatre valors

`TagCategory` a `@muixer/shared` afegeix `XICALLA`: `PINYA | TRONC | XICALLA | ALTRES`. Els
«grups d'etiquetes» de l'especificació són exactament aquestes categories; no hi ha entitat
`TagGroup` ni taula nova.

`inferTagCategory` (`libs/shared/src/utils/tag-category.util.ts`) s'esborra amb el seu spec:
els seus únics consumidors són les dues crides de `person-sync.strategy.ts:401,408`, que
desapareixen amb la desconnexió del sync (§6). A partir d'ací la categoria és sempre
explícita, triada al formulari, i no pot derivar dels `positionTypes`.

### 2. `Person.isXicalla` i el grup XICALLA són coses diferents

`isXicalla` és el boolean d'edat (menors de 16 a la Muixeranga de Barcelona) i governa
lògica real: delegats obligatoris per a menors (`person-delegate.service.ts:101,147,193`),
recomptes d'assistència (`attendance-sync.strategy.ts:357-360`) i quin `Person` es lliga al
compte d'usuari (`person-sync.strategy.ts:296`). **Es queda intacte i editable.**

El grup XICALLA són dues etiquetes independents:

- **Xicalla** — participa a les figures;
- **Xiquet/a de la Colla** — ja forma part de la colla però encara no participa (massa
  menut).

Motiu de tenir-les separades del boolean: quan entra una criatura nova es pot etiquetar
abans de saber-ne l'edat, i els dos conceptes no coincideixen sempre.

Conseqüència a revisar: hi ha filtres que avui usen `isXicalla` i n'hi haurà que hauran de
mirar l'etiqueta. Es mantenen tots dos filtres disponibles i s'etiqueta clarament a la UI
quin és quin («Menor de 16» vs. grup «Xicalla»).

### 3. Catàleg definitiu, en singular

Les etiquetes s'apliquen a **una** persona, així que el nom va en singular encara que la
llista dels tècnics estiga en plural. El catàleg és editable des del Dashboard
(`/config/tags`), de manera que aquesta primera versió no ha de ser perfecta.

| Grup | Etiqueta | `positionTypes` | Nota |
|------|----------|-----------------|------|
| PINYA | Mans | `mans` | 1es mans |
| PINYA | Vent | `vents` | 1es vents |
| PINYA | Segon Cordó | `mans`, `vents` | 2es mans + 2es vents |
| PINYA | Lateral | `laterals` | laterals / diagonals (Morera) |
| PINYA | Agulla | `agulla` | |
| PINYA | Contrafort | `contrafort` | |
| PINYA | Crossa | `crossa` | |
| PINYA | Tap | `tap` | |
| PINYA | Cordó Obert | `cordo-obert` | |
| PINYA | Persona Nova | — | valor per defecte a l'alta (§5) |
| TRONC | Baix | `base` | |
| TRONC | Segona | `segona` | |
| TRONC | Terça | `terça` | |
| TRONC | Alçadora | `alçadora` | |
| TRONC | Figures Netes (SP) | — | capacitat, no posició — única excepció al singular |
| TRONC | Sense Tronc | — | decisió explícita de no fer tronc |
| XICALLA | Xicalla | — | |
| XICALLA | Xiquet/a de la Colla | — | |
| ALTRES | Acompanyant | — | |
| ALTRES | Fem Pinya | — | ve puntualment només a fer pinya |
| ALTRES | Imatge i Paradeta | — | conservada del catàleg legacy |

Decisions concretes:

- **«Mans» i «Vent» conserven el nom legacy exacte**, de manera que el remapatge d'eixes dues
  etiquetes és la identitat i no mou cap fila de `person_positions`.
- **«Persona encara no etiquetada als Troncs» no és una etiqueta.** És l'estat calculat
  *cap etiqueta del grup TRONC*, i per tant no es pot podrir (mai hi haurà una persona amb
  «Segona» i «no etiquetada» a la vegada).
- **«Fem Pinya» va a ALTRES, no a PINYA.** La visualització de Pinyes ja és PINYA + ALTRES
  (§6), així que hi apareixen igual quan es col·loquen les pinyes; i com a etiqueta d'ALTRES
  compleixen la regla tots sols, sense obligar-los a portar «Sense Tronc» només per complir.
- Els presets de tronc `quarta`, `quinta`, `sisena`, `puntal` i `xiqueta` es queden sense
  etiqueta associada. No passa res: no tota posició necessita etiqueta.

### 4. Regla mínima: avís tou, mai bloqueig

Util nou compartit a `@muixer/shared`:

```ts
export enum TagComplianceStatus { OK = 'OK', INCOMPLET = 'INCOMPLET', AMBIGU = 'AMBIGU' }

export function evaluateTagCompliance(categories: TagCategory[]): TagComplianceStatus;
```

Es compten quantes de les tres condicions se satisfan:

1. té almenys una etiqueta de XICALLA;
2. té almenys una etiqueta d'ALTRES;
3. té almenys una de PINYA **i** almenys una de TRONC.

`OK` quan se'n satisfà exactament una (els tècnics diuen «COMPLIS NOMÉS UNA»), `AMBIGU`
quan se'n satisfan dues o més, `INCOMPLET` quan cap.

**Res no es bloqueja mai**: ni l'alta, ni l'edició, ni l'assignació a un node. El resultat es
mostra:

- badge d'estat a la fitxa de persona i al llistat de persones;
- filtre «No compleix la regla» a `/persons` que retorna INCOMPLET + AMBIGU;
- columna d'assistències de la temporada actual al llistat quan eixe filtre està actiu,
  ordenable descendent: és el que permet als tècnics veure les persones noves que **ja venen
  recurrentment** i encara no tenen posició assignada, que és el cas d'ús real («fins que no
  ve uns quants assajos no se li pot determinar una posició»).

L'estat es calcula al servidor a partir de les categories de les etiquetes de la persona i
viatja al DTO de persona; el filtre s'aplica amb la mateixa forma de subconsulta que ja usa
`applyPositionCategoryFilter`.

### 5. Valor per defecte a l'alta

En crear una persona sense cap etiqueta de XICALLA ni d'ALTRES, se li assigna
automàticament **«Persona Nova»** (PINYA). Els tècnics demanaven també «Persona encara no
etiquetada als Troncs», que ací és l'estat derivat de §3 i per tant no cal assignar ni
llevar res.

S'aplica al servei de creació de persona, no a la UI, perquè valga per a qualsevol camí
d'alta.

### 6. Desconnexió de l'import legacy d'etiquetes

De `person-sync.strategy.ts` desapareixen `POSITION_MAPPING`, `upsertPosition`,
`extractUniquePositions` i `resolvePositions`, i la crida a l'import de posicions del bucle
principal (`:125-128`). `createPerson` deixa de passar `positions` (la persona nova rep el
default de §5 pel camí normal de creació).

**`deriveIsXicalla` es queda**: el boolean segueix sent propietat del legacy, amb la seua
lògica de delegats i menors intacta.

Efecte: a partir d'ara el catàleg d'etiquetes i qui les porta és **exclusivament** de
MuixerApp. Un sync ja no pot ressuscitar ni sobreescriure una etiqueta.

Cal actualitzar la fila `posicio` de la taula de mapatge a `docs/SYNC_ARCHITECTURE.md:45`.

### 7. Visualitzacions

Constant compartida a `@muixer/shared`:

```ts
export const TAG_VIEWS = [
  { id: 'guio',   label: 'Guió',   groups: [TagCategory.XICALLA, TagCategory.TRONC] },
  { id: 'pinyes', label: 'Pinyes', groups: [TagCategory.PINYA, TagCategory.ALTRES] },
] as const;
```

A la UI: quatre xips de grup amb selecció múltiple, més dos botons de preset que fixen la
combinació d'un clic. Sense selecció = tots els grups.

S'aplica a quatre llocs:

- **`/persons`** — el filtre de categoria ja és multivalor al backend
  (`person-filter.dto.ts:28`); només cal la UI dels presets.
- **Panell de persones del workspace d'assignació** — avui és un xip de categoria única
  (`person-panel.component.html:139-151`). Passa a multi-grup; `available-persons` ha de
  canviar `positionCategory` de valor únic a llista (`available-persons-query.dto.ts`,
  `available-persons.service.ts:131`), que `applyPositionCategoryFilter` ja accepta. Es manté
  la selecció automàtica de grup segons la zona del node (`categoryForZone:367`) com a punt de
  partida, que l'usuari pot substituir.
- **Vista de participació de l'esdeveniment** — els xips d'etiqueta de cada persona es
  mostren filtrats pels grups de la visualització activa.
- **`/config/tags`** — el catàleg s'agrupa pels quatre grups i els presets fan de filtre
  ràpid.

### 8. Migració de dades

Una sola migració TypeORM:

1. Crea (o actualitza per `slug`) les etiquetes del catàleg de §3.
2. Remapa `person_positions` de les etiquetes legacy a les definitives:

   | Slug legacy | Etiqueta definitiva |
   |---|---|
   | `mans` | Mans *(identitat)* |
   | `vent` | Vent *(identitat)* |
   | `lateral` | Lateral |
   | `segon-lateral` | Lateral |
   | `contrafort` | Contrafort |
   | `crossa` | Crossa |
   | `novatos` | Persona Nova |
   | `acompanyants` | Acompanyant |
   | `imatge-paradeta` | Imatge i Paradeta |
   | `xicalla` | Xicalla |
   | `nens-colla` | Xiquet/a de la Colla |
   | `altres` | *(es descarta)* |

   El remapatge insereix amb `ON CONFLICT DO NOTHING` (una persona amb `lateral` i
   `segon-lateral` acaba amb una sola «Lateral»).
3. Esborra les etiquetes legacy que queden sense cap enllaç.
4. Registra el recompte al log de la migració.

**No hi ha artefacte d'informe.** El filtre «No compleix la regla» de §4 *és* la llista del
que ha quedat per revisar a mà, i és on els tècnics han d'anar després de la migració.

Reversibilitat: el `down` no reconstrueix el catàleg legacy (dades perdudes per disseny).
Es documenta que cal còpia de seguretat abans d'executar-la en producció.

### 9. Neteja d'oportunitat

Coses que toca el canvi i que convé arreglar de pas, no refactors sense relació:

- `'base'` està escrit a mà en tres llocs (`tag-category.util.ts:17` —que s'esborra—,
  `tag-form-modal.component.ts:97` i la migració `1784600000000-TagCategory.ts`). Passa a
  constant compartida a `node-preset.constants.ts`.
- El color de l'etiqueta legacy `ALTRES` és un hex invàlid de dotze caràcters
  (`person-sync.strategy.ts:31`); desapareix amb `POSITION_MAPPING`.
- El formulari d'etiqueta ha de mostrar «cap grup de `positionTypes`» per a XICALLA igual que
  ja fa per a ALTRES (`visiblePositionTypeGroups:117-121`).

## Fora d'abast

- Distingir primeres de segones **als nodes** de les figures. Els nodes es queden amb `mans` i
  `vents`; la distinció viu només a l'etiqueta, tal com s'ha acordat. Si algun dia cal, seran
  `positionTypes` nous i una migració de plantilles.
- Validació dura de la regla, cap forma de bloqueig.
- Tocar `Person.isXicalla` o la lògica de delegats.
- Etiquetes per als pisos de tronc que els tècnics no han demanat.

## Documentació resultant

Al final de la implementació:

- **`docs/TAGS.md` nou** — model d'etiquetes, els quatre grups, el catàleg, la regla mínima,
  les visualitzacions i —punt central— **la relació real amb els `positionTypes` dels nodes
  de plantilla**: que és una pista suau per a ordenar i pintar, no una integritat referencial,
  i què implica això per a qui afegisca etiquetes noves. Amb frontmatter `tags: [domini]` i
  peu de *Veïns*.
- Fila nova a la taula corresponent de `docs/MAP.md`; `pnpm run docs:map` i
  `pnpm run docs:model` amb el diff al commit.
- Actualització de la fila `tag` de `CLAUDE.md`, de `docs/SYNC_ARCHITECTURE.md:45` i de
  `docs/DATA_MODEL.md`.
