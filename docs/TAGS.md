---
tags: [domini]
---

# Etiquetes de persona

Les etiquetes diuen **què fa cada persona a la colla**: si va a pinya, si fa tronc, si és de la
xicalla o si ve puntualment a acompanyar. Són l'eina amb què la tècnica prepara el guió i
col·loca les pinyes, i alimenten l'ordenació de candidats del taller d'assignació.

Este document és la referència del sistema: model, grups, catàleg, la relació —feble a
posta— amb les posicions de les figures, i la regla mínima d'etiquetatge.

---

## 1. Model

Una etiqueta és l'entitat `Tag` (`apps/api/src/modules/tag/tag.entity.ts`), que viu a la taula
**`positions`**. El nom de la taula és herència de l'App legacy, on el concepte es
deia «posició»; el nom del codi és `Tag` i la ruta d'API és `/tags`.

| Camp               | Tipus       | Notes                                                    |
| ------------------ | ----------- | -------------------------------------------------------- |
| `id`               | uuid        |                                                          |
| `name`             | varchar     | únic; és el que es veu a la UI                           |
| `slug`             | varchar     | únic; és la clau estable entre migracions                |
| `shortDescription` | varchar     | opcional                                                 |
| `longDescription`  | text        | opcional                                                 |
| `color`            | varchar     | hex de 7 caràcters; pinta el xip a totes les llistes     |
| `positionTypes`    | text[]      | pistes cap als `positionType` dels nodes — vegeu §3      |
| `category`         | varchar(20) | el **grup**: `TagCategory`                               |

La relació amb `Person` és M:N a través de la taula d'unió **`person_positions`**
(`personsId`, `positionsId`). No hi ha cap restricció de nombre ni de combinació: una persona
pot portar zero, una o vint etiquetes de qualsevol grup.

El **grup** d'una etiqueta és exactament el seu camp `category`, de l'enum `TagCategory` de
`@muixer/shared`. No hi ha cap entitat `TagGroup` ni cap taula de grups: el grup és una
columna, i per això és barat filtrar-hi i impossible que se'n cree un de nou sense tocar codi.

L'API viu a `apps/api/src/modules/tag`: CRUD a `/tags` i assignació de persones amb
`POST /tags/:id/persons` i `DELETE /tags/:id/persons/:personId` (endpoints exactes sempre al
Swagger de `/api/docs`). Al Dashboard, el catàleg s'edita a `/config/tags`.

`Tag` no té esborrat lògic: `DELETE /tags/:id` esborra la fila de veres, i es rebutja amb un
409 mentre hi haja alguna persona amb l'etiqueta assignada. Per a retirar una etiqueta del
catàleg, primer cal llevar-la de tothom.

---

## 2. Els quatre grups i el catàleg

```
TagCategory = PINYA | TRONC | XICALLA | ALTRES
```

- **PINYA** — posicions de pinya.
- **TRONC** — pisos de tronc, base i direcció.
- **XICALLA** — pertinença a la xicalla (no confondre amb `Person.isXicalla`, §5).
- **ALTRES** — qui participa sense fer ni pinya ni tronc.

El catàleg definitiu el crea la migració
`apps/api/src/migrations/1784700000000-TagCatalog.ts` i el renombra
`1784800000000-TagCatalogLegacyPlurals.ts`, que és qui fixa els noms actuals. Estat inicial:

| Grup    | Etiqueta                   | Slug              | `positionTypes` | Nota                                    |
| ------- | -------------------------- | ----------------- | --------------- | --------------------------------------- |
| PINYA   | 1es Mans                   | `mans`            | `mans`          |                                         |
| PINYA   | 1es Vents                  | `vent`            | `vents`         |                                         |
| PINYA   | Segon Cordó                | `segon-cordo`     | `mans`, `vents` | 2es mans i 2es vents                    |
| PINYA   | Laterals / Diagonals       | `lateral`         | `laterals`      |                                         |
| PINYA   | Agulles                    | `agulla`          | `agulla`        |                                         |
| PINYA   | Contraforts                | `contrafort`      | `contrafort`    |                                         |
| PINYA   | Crosses                    | `crossa`          | `crossa`        |                                         |
| PINYA   | Taps                       | `tap`             | `tap`           |                                         |
| PINYA   | Cordó Obert                | `cordo-obert`     | `cordo-obert`   |                                         |
| PINYA   | Persones Noves             | `persona-nova`    | —               | valor per defecte a l'alta (§6)         |
| TRONC   | Baixes                     | `baix`            | `base`          |                                         |
| TRONC   | Segones                    | `segona`          | `segona`        |                                         |
| TRONC   | Terces                     | `terca`           | `terça`         |                                         |
| TRONC   | Alçadores                  | `alcadora`        | `alçadora`      |                                         |
| TRONC   | Figures SP / Figures Netes | `figures-netes`   | —               | capacitat, no posició                   |
| TRONC   | No troncs                  | `sense-tronc`     | —               | decisió explícita de no fer tronc       |
| TRONC   | Tècnica                    | `tecnica`         | `direccio-figura`, `direccio-xicalla` | afegida per `1784900000000-AddTecnicaTag` |
| XICALLA | Xicalla                    | `xicalla`         | —               | xicalla que participa a les figures     |
| XICALLA | Xiquets/es de la colla     | `xiquets-colla`   | —               | ja és de la colla, encara no participa  |
| ALTRES  | Acompanyants               | `acompanyant`     | —               |                                         |
| ALTRES  | Fem Pinya                  | `fem-pinya`       | —               | ve puntualment només a fer pinya        |
| ALTRES  | Imatge i Paradeta          | `imatge-paradeta` | —               | conservada del catàleg legacy           |

**Els noms van en plural**, tal com els escriu l'equip tècnic: descriuen un rol de la colla,
no una persona concreta. Una etiqueta nova hauria de seguir el mateix criteri. El disseny
original els havia posat en singular, cosa que deformava els noms que els tècnics havien
escrit amb més cura —«1es Mans» quedava com a «Mans»—, i es va corregir amb la migració
`1784800000000-TagCatalogLegacyPlurals` (§7).

Els **slugs no segueixen els noms** i no s'han de canviar: són identificadors interns que no
es veuen enlloc de la interfície, i `persona-nova` és a més el punt d'ancoratge de l'etiqueta
per defecte a l'alta (§6).

Este catàleg **no és tancat**: `/config/tags` permet crear-ne, editar-ne i esborrar-ne. La
migració només fixa el punt de partida.

Dos detalls que expliquen absències:

- «Persona encara no etiquetada als Troncs» no és cap etiqueta: és l'estat *cap etiqueta del
  grup TRONC*, que es calcula (§4) i per tant no es pot podrir.
- Els tipus de tronc `quarta`, `quinta`, `sisena`, `puntal` i `xiqueta` es queden sense
  etiqueta associada. No tota posició d'una figura necessita etiqueta.

---

## 3. Relació amb les posicions de les plantilles

**És la part que més sorprén, i cal llegir-la abans de tocar `positionTypes`.**

Els nodes de figura (`FigureNode.positionType` i `InstanceNode.positionType`) guarden un
string tret dels presets de `libs/shared/src/constants/node-preset.constants.ts`: tronc
(`segona`, `terça`, `quarta`, `quinta`, `sisena`, `puntal`, `alçadora`, `xiqueta`), pinya
(`agulla`, `mans`, `laterals`, `vents`, `cordo-obert`, `tap`, `crossa`, `contrafort`,
`comodin`), direccions (`direccio-figura`, `direccio-xicalla`), decoració i el valor solt
`base` (`BASE_POSITION_TYPE`).

`Tag.positionTypes` és una llista d'eixos strings, però **no hi ha cap clau forana ni cap
validació**: `CreateTagDto` només comprova que siga un array de strings
(`@IsArray()` + `@IsString({ each: true })`), i la columna és un `text[]` sense restricció. Un
valor inventat s'alça sense error i simplement no coincidirà mai amb cap node.

I sobretot: **no filtra res al servidor**. Cap consulta de l'API no mira `positionTypes`. El
filtre per etiqueta és sempre per `positionId` (etiqueta concreta): `person.service.ts` i
`available-persons.service.ts`. `positionTypes` només viatja al payload.

L'efecte real és tot al Dashboard i és **cosmètic o d'ordenació**:

- **Ordena candidats** al panell de persones del taller d'assignació: qui porte una etiqueta
  amb el `positionType` del node seleccionat puja amunt de la llista
  (`person-panel.component.ts`, `sortByPosition`, aplicat a la llista de confirmats i a la de
  qui havia dit que venia i no ha vingut). És una ordenació estable per coincidència, no cap
  filtre: ningú no desapareix de la llista per no coincidir.
- **Pinta el punt de coincidència** a les files del panell
  (`person-panel.component.html`) i a la targeta emergent de persona
  (`person-hover-card.component.ts`, `@muixer/pinyes-render`).
- El formulari d'etiqueta ofereix els presets del grup triat com a caselles
  (`tag-form-modal.component.ts`), de manera que per la via normal els valors sempre són
  vàlids. PINYA ofereix els presets de pinya; TRONC, els de tronc més direcció i base;
  XICALLA i ALTRES no n'ofereixen cap, perquè no descriuen cap posició de figura.

**Què vol dir això per a qui cree una etiqueta nova:** que `positionTypes` és opcional i sense
conseqüències. Una etiqueta sense `positionTypes` funciona igual —es pot assignar, filtrar,
mostrar i comptar per a la regla mínima—, només perd l'ajuda d'ordenació i el punt de
coincidència quan hi ha un node seleccionat. I mai no cal quadrar-la amb res: **cap assignació
no es bloqueja mai per les etiquetes**; qualsevol persona es pot assignar a qualsevol node.

Esta feblesa és deliberada. És exactament el que permet que «1es Mans», «1es Vents» i «Segon Cordó»
apunten als mateixos `positionTypes` sense que les plantilles hagen de distingir primeres de
segones. Si algun dia cal eixa distinció als nodes, seran `positionType` nous als presets i
una migració de plantilles, no cap canvi al model d'etiquetes.

---

## 4. La regla mínima d'etiquetatge

`evaluateTagCompliance(categories)` (`libs/shared/src/utils/tag-compliance.util.ts`) diu si
una persona té prou etiquetes:

```ts
{ ok: boolean; missing: TagCategory[] }
```

`ok` és cert quan se satisfà **almenys una** d'estes tres condicions:

1. té almenys una etiqueta de XICALLA;
2. té almenys una etiqueta d'ALTRES;
3. té almenys una de PINYA **i** almenys una de TRONC.

«Almenys una» vol dir *n'hi ha prou amb una*: és la manera de dir que una persona de xicalla no
necessita etiquetes de pinya ni de tronc. **Satisfer-ne més d'una és normal i mai és cap
avís**: la majoria de gent porta pinya i tronc alhora, i xicalla amb etiquetes de pinya també
és vàlid. La regla és binària; no hi ha cap estat d'avís per «massa etiquetes».

`missing` només serveix per a redactar l'avís: `[TRONC]` si només porta pinya, `[PINYA]` si
només porta tronc, `[PINYA, TRONC]` si no porta res. És buit quan `ok`.

**La regla no bloqueja res.** Ni l'alta, ni l'edició, ni l'assignació a un node. Només es veu
en tres llocs, tots a `/persons`:

- **Badge d'avís** «Sense etiquetar» davant de l'àlies, amb el detall al `title` («Falta
  etiqueta de Tronc», etc.). Es calcula al servidor i viatja al DTO de persona com a
  `tagCompliance`; el text el compon `missingTagsLabel` al llistat.
- **Filtre «No compleix la regla»**, el paràmetre `tagRuleOk` del llistat. S'aplica al servidor
  amb `applyTagRuleFilter` (`apps/api/src/modules/person/utils/tag-rule-filter.util.ts`), que
  és la mateixa regla escrita en SQL perquè puga paginar.
- **Columna «Assistències (temp. actual)»**, oculta per defecte i activable des del selector de
  columnes, ordenable pel servidor. Compta les assistències amb estat `ASSISTIT` de la
  temporada que conté el dia d'avui. Amb el filtre de la regla actiu, és el que fa visibles les
  persones noves que **ja venen recurrentment** i encara no tenen posició assignada: el cas
  d'ús real de tot este apartat.

Si canvies la regla, canvia-la als **dos** llocs: la util compartida i la seua traducció a SQL.

---

## 5. `Person.isXicalla` no és el grup XICALLA

Són dos conceptes diferents que conviuen a posta.

| | `Person.isXicalla` | Grup XICALLA |
| --- | --- | --- |
| Què és | booleà d'edat: menor de 16 anys | etiquetes «Xicalla» i «Xiquets/es de la colla» |
| On viu | columna de `persons` | files de `person_positions` |
| D'on ve | derivat del camp `posicio` del legacy en crear la persona; després, editable a mà | assignat a mà des del Dashboard |
| Què governa | delegats obligatoris per a menors, recomptes d'assistència i quin `Person` es lliga al compte d'usuari | la regla mínima (§4) |
| Etiqueta a la UI | «Menor de 16» | «Xicalla» |

**Quan filtrar per cadascun:** `isXicalla` per a qualsevol cosa d'edat o de tutela legal; el
grup XICALLA per a saber qui participa com a xicalla a les figures. No coincideixen sempre:
quan entra una criatura nova se la pot etiquetar abans de saber-ne l'edat, i el booleà descriu
l'edat mentre que l'etiqueta descriu la participació.

---

## 6. Valor per defecte a l'alta

`PersonService.create` assigna automàticament l'etiqueta **«Persones Noves»** (`persona-nova`,
grup PINYA) quan la petició no porta cap etiqueta de XICALLA ni d'ALTRES. Si no troba
l'etiqueta al catàleg —algú l'ha esborrada— no fa res ni falla: l'alta continua.

S'aplica al servei, no a la UI, perquè valga per a qualsevol camí d'alta que hi passe. Les
persones creades pel sync legacy no hi passen (el sync alça la persona directament amb el
repositori), així que arriben sense cap etiqueta.

El seguiment d'estes altes és el filtre «No compleix la regla» de §4: una persona que només
porta «Persones Noves» té una etiqueta de PINYA i cap de TRONC, i per tant hi apareix fins que
algú li'n pose una de tronc. No hi ha cap altre informe ni cap altre artefacte: eixe filtre
*és* la llista del que queda per revisar.

---

## 7. Origen de les dades

El catàleg d'etiquetes i qui les porta són **exclusivament de MuixerApp**.

El sync amb l'App legacy ja no importa cap etiqueta: `person-sync.strategy.ts` no crea ni
sobreescriu cap fila de `positions` ni de `person_positions`. L'únic que continua derivant del
camp legacy `posicio` és el booleà `Person.isXicalla` (`deriveIsXicalla`, claus `CANALLA` i
`NENS COLLA`), i només en crear la persona. Vegeu [[SYNC_ARCHITECTURE]].

Conseqüència pràctica: un sync no pot ressuscitar ni sobreescriure una etiqueta. El que
s'edita a `/config/tags` es queda com està.

El pas del catàleg legacy al definitiu el van fer dues migracions. Una tercera,
`1784900000000-AddTecnicaTag`, hi afegeix «Tècnica» (grup TRONC, apunta als `positionType`s
`direccio-figura` i `direccio-xicalla`, color del preset «Direcció fig.»); el seu `down` només
la lleva si no té ningú assignat.

`1784700000000-TagCatalog` va crear o actualitzar per `slug` les etiquetes del catàleg,
remapar `person_positions` de les legacy a les definitives (`segon-lateral` → laterals,
`novatos` → persones noves, `acompanyants` → acompanyants, `nens-colla` → xiquets/es de la
colla) amb `ON CONFLICT DO NOTHING`, descartar `altres` i esborrar les legacy que quedaven.
Les que ja compartien slug amb el catàleg (`mans`, `vent`, `lateral`, `contrafort`, `crossa`,
`xicalla`, `imatge-paradeta`) s'actualitzen en el lloc: no cal remapar-les ni es mou cap fila
de `person_positions`.

`1784800000000-TagCatalogLegacyPlurals` va rematar la feina. El remapatge anterior es va
construir amb els slugs **singulars** del `POSITION_MAPPING` del sync, però les bases de dades
importades de l'app legacy tenien sis etiquetes amb el slug en **plural** (`primeres`, `vents`,
`laterals`, `segons-laterals`, `contraforts`, `crosses`), que per això van sobreviure amb la
seua gent i al grup ALTRES —on complien la regla mínima sense fer-ho de veres. Esta migració
les absorbeix (`primeres` → 1es mans, `vents` → 1es vents, les dues laterals → laterals i
diagonals, `contraforts` → contraforts, `crosses` → crosses) i, **tot seguit**, renombra el
catàleg amb els noms de l'equip tècnic. L'ordre no és negociable: «Contraforts» i «Crosses»
són alhora el nom nou d'una etiqueta del catàleg i el nom que tenien dues de les legacy, i
`positions.name` és únic.

Els `down`: el de `TagCatalog` és irreversible per disseny —no reconstrueix el catàleg legacy,
només lleva les etiquetes noves sense ningú assignat—, i el de `TagCatalogLegacyPlurals`
restaura els noms anteriors però tampoc no ressuscita les sis etiquetes absorbides. Cal còpia
de seguretat abans d'executar-les en producció.

---

*Veïns: [[DATA_MODEL]] · [[PINYES_MODULE]] · [[SYNC_ARCHITECTURE]] · [[DASHBOARD_UI]]*
