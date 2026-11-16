# Quadre de troncs — disseny

**Data:** 2026-11-12 · **Estat:** pendent d'aprovació

## Per què

Abans de MuixerApp, l'equip tècnic preparava cada assaig amb un full de càlcul: una columna per grup
(Mans, Base, Segones, Alçadores, Terces, Persones noves, Xicalla), les persones que venen ordenades
per alçada, un total per columna i un color de fons segons si venien a l'assaig i a la pròxima actuació.
Ara treballen amb MuixerApp i han demanat recuperar aquesta vista dins de l'app.

**Quan es fa servir:** és el primer que miren quan munten l'assaig, abans de crear cap tronc. Amb la
foto de qui hi ha, decideixen quines figures fan i després omplen els pisos segons alçada, caràcter,
veterania, personalitat i la participació que la persona ja té a l'event.

**Què ha de ser:** una taula senzilla, sense massa informació, que respecte els estils, colors i
icones que ja fa servir l'app.

## Objectius

1. Veure d'un cop d'ull qui ve a l'assaig, agrupat per etiqueta i ordenat per alçada.
2. Saber qui ve (o no) a la pròxima actuació, incloent-hi un cas que el full no mostrava: qui **no** ve
   a l'assaig però **sí** a l'actuació.
3. Saber quanta participació té cada persona a l'event, sobretot qui encara no ha fet cap figura.
4. Que cada tècnic puga triar les columnes i l'ordre, i que l'app ho recorde.

## Fora d'abast

- No és editable. Fer clic a una persona no fa res: només és de consulta.
- No hi ha etiqueta principal ni pesos a les etiquetes. El model ja no en té: les etiquetes d'una
  persona són totes iguals (vegeu `docs/TAGS.md`). La marca «[B, A]» del full desapareix.
- No mostra observacions, gènere ni notes, que ja surten a la resta de l'app.
- No substitueix la pestanya **Participació** de l'event (taula persona × segment). Aquesta vista és
  una foto per grups pensada per a muntar troncs.
- No es configura per a tota la colla: no hi ha cap camp nou a `colla_settings`.

## Coses a evitar

- Una pantalla atapeïda: si cal triar entre mostrar una dada o no, millor no.
- Colors o icones nous inventats quan l'app ja en té per a la mateixa idea.
- Que les persones repetides en diverses columnes enganyen el recompte de gent (vegeu «Totals»).

## On s'obri

Un botó a la pestanya **Troncs** del `SegmentWorkspaceComponent` (assignació d'un segment) obri un
modal que ocupa quasi tota la pantalla. Mostra l'**event** del segment, no només el segment.

## Contingut

### Columnes

- Cada columna és **una etiqueta** (`Tag`). Columnes per defecte, buscades per `slug`, en aquest ordre:
  `mans` (1es Mans), `baix` (Baixes), `segona` (Segones), `alcadora` (Alçadores), `terca` (Terces),
  `persona-nova` (Persones Noves), `xicalla` (Xicalla). Si a la colla no existeix algun slug, la
  columna no apareix.
- Sempre hi ha una última columna fixa, **Altres**: qui hauria d'aparéixer a la taula però no té cap
  de les etiquetes de les columnes visibles. Així ningú es perd.
- **Una persona amb diverses etiquetes apareix a cada columna corresponent** (per exemple, la Mònica
  apareix a Terces, Baixes i Alçadores). Quan passes el ratolí per damunt d'una aparició, s'il·luminen
  totes les seues aparicions de la taula.

### Configuració per tècnic

- Un control dins del modal permet triar quines etiquetes es veuen com a columnes (qualsevol etiqueta
  del catàleg) i en quin ordre.
- Es guarda al `localStorage` del navegador del tècnic. Si no hi ha res guardat, o el que hi ha no es
  pot llegir, s'apliquen les columnes per defecte. Una etiqueta guardada que ja no existeix
  s'ignora sense error.

### Qui apareix

- **Ve a l'assaig:** estat de l'event `ANIRE` o `ASSISTIT`, és a dir, ha dit que vindrà o ja ha passat
  llista.
- **Cas nou:** no ve a l'assaig (qualsevol altre estat) però sí a la pròxima actuació
  (`nextPerformanceStatus === ANIRE`). Apareix **al final de la seua columna, atenuada**, amb la icona
  d'actuació.
- **Assignada però no ve:** té alguna assignació a l'event però no ve a l'assaig (per exemple, ha
  respost `NO_VAIG` després de ser col·locada). Apareix **marcada com a avís** perquè el tècnic se
  n'adone i la traga de la figura. Si a més va a l'actuació, preval l'avís sobre l'atenuat.
- Ningú més. Només persones actives.

### Ordre dins de cada columna

Per alçada d'espatlles (`shoulderHeight`), de més alt a més baix. Qui no té alçada va al final. Les
persones atenuades del cas nou van després de totes les altres, amb el mateix criteri entre elles.
Empats: per àlies.

### Cada persona (una línia)

- **Àlies.**
- **Alçada d'espatlles**, en text discret (el mateix format que el panell de persones de l'assignació).
- **Punts de participació**: nombre de **figures diferents** (instàncies de figura) en què està
  fa tronc o base a **tot l'event** (tots els segments). Només compten els llocs de **tronc o base**
  (àrea `TRONC`); la pinya i les direccions no compten (canvi demanat després de la primera versió, que
  comptava també la pinya i les direccions de tronc i xicalla). Dos llocs de la mateixa figura compten una
  vegada. No es pot reutilitzar `placementCount` (compta nodes).
  0 = res · 1 = ● · 2 = ●● · 3 = ●●● · 4 o més = ●●●+.
- **Icona d'actuació** (`ICON_ACTUACIO`, la mateixa que el panell de persones) si va a la pròxima
  actuació.
- **Color de fons de la línia**, amb tokens del sistema de disseny:
  - ve a l'assaig i a l'actuació (`ANIRE`): verd (to d'èxit);
  - ve a l'assaig i no va a l'actuació (`NO_VAIG`): roig (to d'error);
  - ve a l'assaig i no ha contestat l'actuació: sense color;
  - no ve a l'assaig però sí a l'actuació: atenuada;
  - assignada però no ve a l'assaig: to d'avís, amb una icona d'avís i un `title` que ho explica.
  - Si l'event no és un assaig, o no hi ha pròxima actuació a la temporada (`nextPerformanceStatus`
    és `null`), no hi ha color ni icona d'actuació.

### Totals

- **Per columna:** nombre de persones que venen a l'assaig amb aquella etiqueta. Les atenuades no hi
  compten: es mostren al costat, a part (per exemple, «+2 actuació»).
- **Global, a la capçalera del modal:** persones **úniques** que venen a l'assaig. És el número de
  veritat, perquè la mateixa persona pot sumar en diverses columnes.
- Les persones assignades que no vénen no compten a cap total.
- L'interruptor «Només qui no ha fet cap tronc» no canvia cap total: només amaga línies.

### Capçalera del modal

Títol de l'event, total global, el control de columnes i un interruptor **«Només qui no ha fet cap
tronc»** que amaga les persones amb 1 o més figures.

### Frescor de les dades

Es carreguen cada vegada que s'obri el modal (els tècnics treballen en paral·lel en diferents
segments). No cal refresc automàtic mentre està obert.

## Dades: què ja existeix

`GET /events/:eventId/participation` (`EventParticipationService`) ja retorna, per persona: àlies,
`shoulderHeight`, `attendanceStatus`, `nextPerformanceStatus`, etiquetes (`positions`, amb `slug`) i
les assignacions per segment. Amb això es calculen columnes, colors i punts al frontend.

**El que falta:** aquest endpoint només retorna qui ve a l'event (`ANIRE`/`ASSISTIT`) o qui hi té
alguna assignació. No inclou el cas nou (no ve a l'assaig però sí a l'actuació). Cal afegir-los
**sense canviar les files que ja veu la pestanya Participació**.

## Sistema de disseny

- `lib-modal` només arriba a `max-w-4xl` i `max-h-[85vh]`. Cal una mida nova del component per a un
  modal quasi de pantalla completa, no una classe feta a mà.
- Colors amb tokens (mai hex ni valors arbitraris de Tailwind); classes dinàmiques amb mapes estàtics.
- Textos en català, segons la skill `language-rules`.

## Manual

Actualitzar `docs/manual/12-assignacio-troncs.md` amb el botó i el modal, i regenerar-ne les captures
(`pnpm run docs:manual-shots`), difuminant les dades personals però no l'àlies.

## Decisions preses per l'assistent (no per l'usuari)

- L'alçada es mostra a cada línia i l'ordre és de més alt a més baix.
- Les persones atenuades no compten al total de la columna i es mostren a part.
- Les dades es carreguen en obrir el modal, sense refresc automàtic.
- Columnes per defecte buscades per `slug`, perquè els noms de les etiquetes es poden canviar.
- Els totals no canvien amb l'interruptor «Només qui no ha fet cap tronc».
- Les persones assignades que no vénen es marquen amb el to d'avís, s'ordenen per alçada amb la resta
  i no compten als totals.
- Només persones actives.

## Deixat al criteri de qui ho construïsca

- Com afegir el cas nou a l'API: un paràmetre de consulta a l'endpoint de participació, un camp nou a
  la resposta o un endpoint propi.
- L'aspecte exacte del control de columnes (llista amb caselles i fletxes, arrossegar, etc.).
- Com es veu exactament l'il·luminat de les aparicions repetides.
- Què fa la taula en pantalles estretes (el dashboard s'usa sobretot en ordinador o tauleta), mentre
  no hi haja scroll horitzontal de la pàgina sencera.
