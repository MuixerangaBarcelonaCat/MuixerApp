---
tags: [domini]
---

# Resum imprimible d'un esdeveniment (PDF)

El botó **Imprimeix** del detall d'un esdeveniment (Dashboard) descarrega un PDF amb:

- una **capçalera a tota l'amplària**: el logo i, al costat, el títol (en Fraunces) amb la data,
  l'hora i el lloc;
- les **notes** internes de l'esdeveniment (markdown), en dues columnes **equilibrades**; les
  seccions (`#`, `##`) van en Fraunces i les subseccions (`###`) en Quicksand negreta;
- els **segments numerats**, en una taula de dues columnes: una cel·la per segment, omplida
  per files (1 2 / 3 4 / 5 …); si n'hi ha un nombre senar, l'última fila deixa una cel·la buida.
  Cada segment porta les seues figures i, per a cada figura, la direcció entre claudàtors a la
  línia de davall del nom i els pisos del tronc, un pis per línia (base → dalt); un pinet (una persona
  per pis) es queda en una sola línia «A // B // C».
  El número del segment va en Fraunces gran i molt clar, a la cantonada de dalt a l'esquerra,
  darrere del text. Una línia fina
  separa les figures d'un mateix segment. El nom de la figura s'amaga quan el títol derivat del
  segment ja el diu (una sola figura, o totes iguals: «2 Pd4»). Si el segment té un nom
  propi («Ronda final»), els noms de les figures es mostren sempre.
- un **peu** a cada pàgina amb el títol i la data de l'esdeveniment, i el número de pàgina.

La pàgina és sempre blanca: el color només va al text i a les línies.

Cap segment es parteix entre dues pàgines: si una fila no hi cap, passa sencera a la següent.

## Com funciona

```
Dashboard (Imprimeix) ──GET /api/events/:id/summary.pdf──► EventSummaryController
                                                             │
EventSummaryService: EventService.findOne + EventSegmentService.findAllByEvent/getTroncView
                     + NodeAssignmentService.getEventAssignmentSummary
                     → buildEventSummaryData()  (dades pures, JSON)
                     → TypstPdfRenderer.compile('event-summary.typ', dades).pdf()
```

- **Typst al servidor.** El PDF el compon [Typst](https://typst.app) dins del procés de l'API
  amb el mòdul natiu `@myriaddreamin/typst-ts-node-compiler` (Typst 0.14.2): no hi ha navegador
  sense capçalera ni cap servei extern, i la sortida és idèntica en qualsevol màquina. Compilar
  un resum tarda uns pocs mil·lisegons.
- **Les dades entren com a JSON, mai com a codi.** La plantilla llig `sys.inputs.data`, així que
  els títols, els àlies i les notes no poden injectar marcatge Typst.
- **Les notes** les renderitza el paquet [`cmarker`](https://github.com/SabrinaJewson/cmarker.typ)
  0.1.8, copiat al repositori (`assets/typst/vendor/cmarker/`, MIT) perquè l'API no descarregue
  res en temps d'execució. S'hi crida amb `raw-typst: false` (ignora el codi Typst amagat en
  comentaris `<!--raw-typst … -->`) i les imatges s'imprimeixen com el seu text alternatiu (un
  fitxer inexistent faria fallar tota la compilació).
- **Fonts pròpies incrustades**: Quicksand (text, també el codi de les notes, emmarcat amb una
  línia fina) i Fraunces (títols i números de segment; tall estàtic `Fraunces9pt-SemiBold` del
  [repositori original](https://github.com/undercasetype/Fraunces), perquè Typst no llig els woff2
  de `@fontsource`), en TTF a `assets/typst/fonts/` amb les seues llicències OFL. Atkinson
  Hyperlegible no s'hi fa servir: és només per a la vista de projecció.
- **Colors del sistema de disseny.** La plantilla copia els tokens `INK`/`CREASE`/`PAPER` de
  `libs/ui/src/lib/tokens/fixed-colors.ts`. Quicksand no té cursiva: l'èmfasi
  (`*text*`) s'imprimeix subratllat.
- **Columnes equilibrades per a les notes.** Typst no equilibra mai les columnes
  ([typst#466](https://github.com/typst/typst/issues/466)): el contingut curt ompli la columna
  esquerra i deixa buida la dreta. La plantilla les reparteix ella mateixa: agrupa les notes en
  blocs (paràgrafs, títols, llistes, cites, taules), mesura amb `measure()` cada tros inicial i
  final a l'amplària de la columna, i talla on la columna més alta queda més baixa, sense deixar
  mai un títol al final de la columna esquerra. No parteix mai un bloc. Si les notes no caben a
  la resta de la pàgina, flueixen per columnes normals (esquerra → dreta → pàgina següent).
- **Només TECHNICAL/ADMIN**: les notes són internes i no arriben mai a la PWA.

## Fitxers

| Fitxer | Paper |
|--------|-------|
| `apps/api/src/modules/event-summary/` | Mòdul: controlador, servei, `buildEventSummaryData`, `TypstPdfRenderer` |
| `apps/api/src/assets/typst/event-summary.typ` | Plantilla del document |
| `apps/api/src/assets/typst/fonts/`, `vendor/cmarker/` | Fonts i paquet de markdown (còpia local) |
| `apps/api/src/assets/typst/logo.svg` | Còpia de `apps/dashboard/public/assets/logoMuixe.svg` (Typst només llig fitxers de la seua carpeta): si canvia el logo, cal copiar-lo també ací |
| `libs/shared/src/utils/tronc-summary.util.ts` | `formatTroncSummary`: el text dels pisos, compartit amb la llista de segments |
| `apps/dashboard/…/event-detail/` | Botó Imprimeix; `EventService.downloadSummaryPdf` + `saveBlob` |

## Canviar la plantilla

La plantilla etiqueta el que imprimeix (`text(...)<event-title>`, `<segment-title>`,
`<figure-tronc>`, `<segment-number>`, `<figure-separator>`, `<footer-date>`, `<app-logo>`, els blocs `<notes-columns>` (amb `<notes-left>`/`<notes-right>` quan s'equilibren) i la taula `<segments-table>`…) i `event-summary.template.spec.ts` compila la plantilla real i llig aquestes
etiquetes del document ja compost. Qualsevol canvi de contingut s'hi ha de reflectir; els canvis
purament visuals (mides, colors, marges) es comproven generant un PDF de mostra.

**Actualitzar Typst o `cmarker`:** cada versió de `cmarker` exigeix una versió mínima de Typst
(`compiler` a `vendor/cmarker/typst.toml`). En pujar `@myriaddreamin/typst-ts-node-compiler`,
comproveu la versió de Typst que porta (`#sys.version`) abans de pujar `cmarker`.

## Docker

El mòdul natiu publica un binari per a cada libc. La imatge de l'API és Alpine (musl) i el
`Dockerfile` instal·la només la variant musl (`pnpm.supportedArchitectures.libc`); sense això,
pnpm hi afegiria també la de glibc (50 MB inútils).

---

*Veïns: [[PINYES_MODULE]] · [[DATA_MODEL]] · [[DOCKER_ARCHITECTURE]]*
