---
tags: [qa]
---

# Rendiment de renderització de la PWA (pantalla de projecció)

Anàlisi i pla de treball per a la lentitud de la pantalla de projecció de segments a la PWA
(`events/:eventId/segments/:segmentId`). Document pensat per ser executat en una sessió pròpia:
cada troballa porta evidència al codi, el canvi proposat, l'esforç i com verificar-lo.

**Estat de la revisió:** codi reverificat a `develop` @ `2778b720` (29-09-2026); implementació a la branca `feat/optimize-render-pwa`. Des de la primera
versió (`38e335ca`) no ha canviat res de `libs/pinyes-render`, `apps/pwa` ni del backend de projecció;
els canvis entremig són de notificacions push i del límit de Caddy, que afecten F8 i F9. Les
referències `fitxer:línia` són d'aquest commit; si han derivat, busca el símbol, no la línia.

La pantalla és `SegmentProjectionComponent` (`apps/pwa/src/app/features/events/segment-projection/`),
que només fa fetch i delega tot el render a `<lib-pinya-projection>` de `@muixer/pinyes-render` —
el mateix component que fa servir el Dashboard (`ProjectionViewComponent`, Previsualitza,
`event-print`). **Tota millora aquí beneficia les dues apps**, i qualsevol regressió també: els tests
de `libs/pinyes-render` són la xarxa de seguretat.

## Context d'ús (condiciona les prioritats)

- **On:** a la plaça, en directe, just abans de cada figura, i tècnics que la projecten en una
  tauleta o pantalla gran per al grup. No és una consulta tranquil·la des de casa.
- **Qui:** 40–100 mòbils variats alhora (Android de gamma mitjana/baixa i iPhone), amb previsió de
  créixer. Molts comparteixen la IP pública (mateixa wifi o CGNAT de l'operador).
- **Símptoma observat:** el pan i el zoom van a batzegades. Això apunta a F1, F2 i F5 (render per
  frame), no a la xarxa.
- **Frescor:** cal que un canvi del tècnic arribi als membres sense tornar a entrar, però s'abordarà
  més endavant (F9). Tot el que es faci ara no pot fer-ho més difícil.

## Arquitectura del render (per entendre les troballes)

La projecció **no** és un sol canvas. Són dues capes superposades que s'han de mantenir alineades:

1. Un `<app-figure-canvas mode="readonly">` (Konva) amb els nodes de pinya i base de totes les
   figures del segment.
2. Un panell tronc **en DOM** per figura (`<app-tronc-view>`), posicionat en absolut a sobre del
   canvas amb `left/top/transform: scale()`.

El pan i el pinch són handlers propis sobre `touchmove` (`figure-canvas.component.ts:990-1019`), no
el drag de Konva. Cada moviment del dit fa `stage.batchDraw()` i `emitStageTransform()`, que emet
`(stageTransformChanged)` → `PinyaProjection.stageTransform.set(t)` (`pinya-projection.component.ts:611`)
→ es recalcula `distributionTroncPanels()` (`:487`) → Angular reescriu `left/top/transform` de cada
panell. **Aquest llaç s'executa a cada `touchmove`** (que en pantalles de 90–120 Hz pot ser més d'un
cop per frame) i també durant el vol de càmera d'entrada (`onUpdate` del tween, `:658`).

## Què ja està fet (no ho refacis)

- **Batching de queries al backend.** `projection.service.ts:92-101` carrega nodes i assignacions de
  totes les instàncies amb `getNodesByInstances`/`getAssignmentsByInstances` (2 queries) en lloc de 4
  per figura.
- **L'app és zoneless.** No hi ha `zone.js`, la CD la disparen els senyals. El que importa és *quins*
  senyals s'escriuen per frame (veure F2).
- **El polling s'ha eliminat.** Ni `pollTick` ni `/projection/version` existeixen. La projecció es
  demana un cop en entrar a la pantalla i a cada prev/next — veure F9.
- **Les capes de graella i contorns ja no escolten.** `gridLayer` i `outlineLayer` es creen amb
  `listening: false` (`figure-canvas.component.ts:820-821`). La capa que importa és `pinyaLayer` (F5).

## Implementat a `feat/optimize-render-pwa` (29-09-2026)

| Canvi | On |
|-------|----|
| **F2.1–F2.3.** `renderGrid()` surt abans d'esborrar si la graella és desactivada i buida; l'emissió de `stageTransformChanged` es coalesceix a un `requestAnimationFrame` durant el pan/pinch/roda (`touchend` i la resta de camins emeten síncronament); el `rect` del contenidor es llegeix un cop a `touchstart` en lloc de a cada `touchmove` | `figure-canvas.component.ts` |
| **F1.** Els arrays de nodes tronc/base/direcció es memoitzen per instància (`WeakMap`), de manera que `TroncViewComponent` no rep identitats noves a cada frame | `pinya-projection.component.ts` |
| **F5.1.** En mode `readonly`, `pinyaLayer.listening(false)` mentre dura el gest i el hit-graph es reconstrueix un cop en fase de captura de `touchend`, abans que Konva resolgui el toc: un toc sobre una persona just després d'un pan es comporta igual que abans | `figure-canvas.component.ts` |
| **F5.2.** En mode `readonly`, el canvas de cada capa es limita a `pixelRatio` 2 (per canvas, no el `Konva.pixelRatio` global) | `figure-canvas.component.ts` |
| **F8.** `dataGroups` `freshness` (timeout 3 s, maxAge 12 h) **només** per a `/api/me/events/*/segments/*/projection` + `timeout()` de 20 s a `ProjectionService` (l'error ja pinta la pantalla amb «reintenta») | `ngsw-config.json`, `projection.service.ts` |

### Mesures (Pixel 7 emulat, CPU 4×, segment de 4 figures i 83 assignacions, `nx serve pwa -c production`)

150 passos de pan + 60 de pinch out + 60 de pinch in, tocs sintètics via CDP; mediana de 3 passades.

| | Baseline | Ara |
|---|---|---|
| `TaskDuration` del gest | 5,3 s | **4,0 s** (−25 %) |
| JS (`ScriptDuration`) | 1 110 ms | **860 ms** (−23 %) |
| Layout | 57 ms | 36 ms |
| Long tasks (>50 ms) | 0 | 0 |
| Signatura de posició dels panells tronc | — | idèntica (no hi ha deriva) |

**Límit de la mesura:** el headless no té GPU ni vsync real, així que els frames ja eren fluids
(p95 17,6 ms) tant abans com ara; el guany es veu en feina de CPU, no en *frames caiguts*. Cal
confirmar-ho en un mòbil de gamma baixa i a la tauleta dels tècnics. El perfil de CPU del baseline
mostrava que el gruix no era JS sinó feina nativa de pintat del canvas (`(program)` ≈ 5 s de 12 s), que
és el que ataquen F5.1 i F5.2. `scripts` de mesura: no es versionen; el procediment és a *Com mesurar*.

**Verificació de comportament:** el hit-graph després d'un pan dona els mateixos punts que després
d'un redibuix complet (277/277), i els tests del PWA (406) i del Dashboard (2 169) passen.

## Relació amb altres branques

- **`feat/optimize-request`** (pendent de fusionar, [[REQUEST_AUDIT]]): redueix de 29 a 7 les
  peticions del *workspace de segments del Dashboard*. **No toca** `apps/pwa`, `libs/pinyes-render`
  ni `projection.service.ts`, així que no millora ni l'aparició ni el prev/next de la PWA. Sí que toca
  `node-assignment.service.ts` (nou endpoint): **fusiona-la abans de fer F7** per evitar conflictes.
- La seva secció §0 / P1 sí que és rellevant per a la plaça: Caddy limita per IP (`key {remote_host}`)
  a 600 req/min a `/api/*` i **10 req/min a `/api/auth*`, inclòs el refresh**. Amb 40–100 mòbils
  darrere la mateixa IP, el refresh de token s'esgota i la pantalla falla per motius que no són de
  render. No és d'aquest document, però **cal verificar-ho abans de cap assaig de proves amb gent**.

## Troballes

Només queden les pendents; les fetes són a la secció anterior (els identificadors F1, F2.1–3, F5 i F8 es mantenen per traçabilitat).
Ordenades per impacte esperat en el símptoma real (pan/zoom). L'estimació és **hipòtesi**, no mesura:
fes primer el baseline (secció *Com mesurar*) i deixa caure el que no es confirmi.

### F2.4 — Overlay dels panells amb un únic `transform` (pendent, opcional)

Posar tots els panells dins d'un únic contenidor amb `transform: translate(stageX, stageY) scale(stageScale)`
i col·locar-los a dins en coordenades de món: per frame hi hauria una sola escriptura d'estil
(compositor, sense layout) en lloc d'N `left/top`. Fa innecessari el gruix de
`distributionTroncPanels()` per frame. Toca la geometria de l'overlay (històricament delicada) i
`OwnPositionMarker`, que ja rep `stageTransform`.

**Estat:** amb el baseline actual el layout és 36 ms sobre 5 s de gest (4× CPU), és a dir
negligible: **no es paga**. Reobre-ho només si una traça en un dispositiu real mostra *Layout* per frame.
**Verificació si es fa:** els panells no poden derivar dels nodes en cap zoom; prova amb una figura
amb `projectionAngle` != 0.

### F3 — Cada panell tronc es renderitza tres vegades

**Evidència:** `tronc-panel-measurer.component.ts` renderitza cada panell **dos cops** fora de
pantalla (una sonda sense nodes de direcció i el panell final amb l'amplada restringida) per mesurar-ne
la mida real; el panell viu és el tercer. El comentari de capçalera explica per què calen els dos: és
una decisió correcta, no un error. Els panells de mesura queden muntats (amb els seus `FitText`).

El problema és **quan es torna a executar**: `measurePanels()` (`pinya-projection.component.ts:121`)
depèn de les instàncies, i qualsevol refetch amb el mateix contingut en objectes nous torna a disparar
el cicle sencer. Avui només passa en entrar i en cada prev/next; amb refresc automàtic (F9) passaria
a cada refresc.

**Canvi proposat:** cachejar `measuredTroncSizes` amb una clau estable del contingut del panell (ids
dels nodes + noms assignats) i saltar-se la mesura quan la clau no ha canviat.

**Esforç:** petit. **Prioritat:** baixa avui, **obligatòria abans de F9**.

### F4 — `FitTextDirective`: un `ResizeObserver` i una lectura de layout per cel·la

**Evidència:** `fit-text.directive.ts:54` crea un `ResizeObserver` per element, i la directiva
s'aplica dins dels bucles per node de `tronc-view.component.html:233,303`. Cada `fit()` (`:71`)
llegeix `clientWidth` i `getComputedStyle` (lectures síncrones de layout).

**Correcció respecte a la versió anterior:** això **no** es repeteix a cada frame del gest. L'`effect`
només segueix inputs de tipus `string`/`number`, que no canvien durant el pan, i el `scale()` d'un
pare no altera `clientWidth`, així que el `ResizeObserver` tampoc salta. El cost és només en el render
inicial (×3 per F3) i en canvis de mida reals. No explica les batzegades.

**Canvi proposat:** cachejar família/pes de la font en lloc de cridar `getComputedStyle` a cada ajust.
Un sol `ResizeObserver` per panell només si la traça d'entrada ho demana.

**Esforç:** mitjà — la directiva és compartida, mira'n tots els usuaris abans. **Prioritat:** baixa.

### F6 — El payload porta dades que el membre no necessita (i que no hauria de veure)

**Decisió (29-09-2026): no es fa.** L'equip no ho veu necessari; el payload de `/me` es queda com està. Es reobrirà només si canvia el criteri de privacitat ([[GDPR_COMPLIANCE]]).

**Evidència:** `projection.service.ts:141-171` retorna `conflicts` i `personAttendance` de **tot**
l'event, i cada assignació inclou `notes`, `notesEmoji` i `shoulderHeight` de la persona
(`node-assignment.service.ts:84-92`, `:242-244`). Cada node porta camps que només fan servei a
l'editor (`sourceNodeId`, `originNodeId`, `createdById`, `isSnapshotted`, `renglaId`).

La PWA no pinta les notes (la projecció no passa `personDetailsMap` al canvas), però **viatgen igual
a tots els membres** i es veuen a les DevTools. Caddy serveix amb gzip, així que el cost en bytes és
moderat; el real és el `JSON.parse` i les allocations al telèfon.

**És una qüestió de privacitat abans que de rendiment:** consulta [[GDPR_COMPLIANCE]] abans de decidir
què es queda.

**Canvi proposat:** un DTO específic per a `/me` (el Dashboard pot seguir rebent-ho tot). Els
`conflicts` probablement no li serveixen al membre; `personAttendance` sí, perquè pinta l'estat
d'assistència.

**Esforç:** mitjà — toca el contracte compartit `ProjectionData`, que consumeixen les dues apps.

### F7 — El backend torna a consultar el que ja té carregat

**Evidència:** `projection.service.ts:155` crida `getSegmentConflicts(segmentId)`
(`node-assignment.service.ts:811`), que torna a carregar **totes** les assignacions del segment amb
relations. El comentari de `classifySegmentConflicts` (`:862-867`) diu que la projecció ja el
reutilitza sense tornar a consultar, però **el codi no ho fa**: el comentari és fals.

**Canvi proposat:** classificar sobre les assignacions ja carregades. Compte: `getAssignmentsByInstances`
retorna `AssignmentDetail` (DTO) i `classifySegmentConflicts` espera entitats `NodeAssignment`, així
que cal una variant que treballi amb el DTO. Com que F6 no es fa, la troballa continua vigent per a la PWA i el Dashboard.

**Esforç:** petit. **Condició:** després de fusionar `feat/optimize-request`.
**Verificació:** `segment-conflicts.integration.spec.ts` i
`participation-conflicts-equivalence.integration.spec.ts` cobreixen l'equivalència.

### F9 — Decisió oberta: avui la projecció no s'actualitza mai

La projecció que veu el membre és la del moment d'entrar. Si un tècnic reassigna durant l'assaig,
ningú no se n'assabenta fins que no surt i torna a entrar. Es vol resoldre més endavant; el que cal
saber ara per no tancar-se portes:

- **Qualsevol refresc torna a activar F1, F2 i F3.** F3 (cache de mesures) és condició prèvia.
- **Pressupost de peticions:** Caddy compta per IP. Amb 100 mòbils darrere la mateixa IP, un polling
  cada 10 s ja són 600 req/min, **el límit sencer de `/api/*`**, abans de cap altra petició. Un
  polling hauria de ser d'una versió barata (la query està coberta per
  `IDX_node_assignments_segment_person`), amb jitter, pausa amb `document.hidden` i un interval que
  aguanti el creixement de la colla.
- **Web Push ja existeix** (`custom-sw.js`, `push-subscription.service.ts`), però no serveix per a
  un refresc silenciós: el navegador obliga a mostrar una notificació per cada push. Serveix per
  avisar («t'han canviat de lloc»), no per sincronitzar la pantalla.
- **SSE** (ja n'hi ha per al `sync`, veure [[SSE_AUTH]]) seria el camí natural per al temps real, però
  100 connexions obertes des de la plaça també passen pel mateix Caddy.

## Com mesurar

Cap canvi d'aquesta llista s'hauria de fer sense un número abans i un número després.

**Regla base:** build de producció, mòbil real, dades reals. Un `nx serve` de dev no representa res.

### Dades

Cal el pitjor cas real: el segment amb més figures i més gent assignada. Apunta `eventId` i
`segmentId` i fes servir **sempre els mateixos** abans i després.

### Baseline de backend

L'API en dev té `logging` actiu a TypeORM (`database.module.ts:26`, `logging: isDevelopment`), així
que el compte de queries surt per consola.

```bash
TOKEN=$(curl -s localhost:3000/api/auth/login -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E2E_EMAIL\",\"password\":\"$E2E_PASSWORD\"}" | jq -r .accessToken)

URL=localhost:3000/api/me/events/$EVENT_ID/segments/$SEGMENT_ID/projection

# latència: 10 passades, queda't amb la mediana, no amb la primera
for i in $(seq 10); do curl -s -o /dev/null -w '%{time_total}\n' -H "Authorization: Bearer $TOKEN" $URL; done

# mida crua i mida que viatja de debò
curl -s -H "Authorization: Bearer $TOKEN" $URL | wc -c
curl -s -H "Authorization: Bearer $TOKEN" -H 'Accept-Encoding: gzip' $URL --compressed -o /dev/null -w '%{size_download}\n'
```

Compte de queries: buida la consola de l'API, fes **una** petició, compta les línies `query:`.

### Baseline de dispositiu

```bash
nx serve pwa --configuration=production   # port 4300
```

1. Mòbil Android amb depuració USB, `chrome://inspect/#devices`.
2. **Port forwarding** a `chrome://inspect`: `4300 → localhost:4300`. Així el mòbil obre
   `http://localhost:4300` sense tocar xarxa ni host binding.
3. Inspect → DevTools apuntant al dispositiu.

Tres números, sempre els mateixos:

| Mesura | Com | Què delata |
|--------|-----|------------|
| Fluïdesa de pan i pinch | Record → 5 s de pan continu + 5 s de pinch → stop. Compta long tasks (>50 ms) i frames caiguts a la pista *Frames* | F1, F2, F5 |
| Layout thrash | A la mateixa traça, avisos **«Forced reflow»** i blocs *Recalculate Style* / *Layout* durant el gest | F2.3, F2.4 |
| Temps fins a veure les figures | Record → toca el segment → para quan es vegi la pinya | Si el gruix és **posterior** a la resposta, el problema és render (F3/F4), no xarxa |

Per simular l'assaig sense anar-hi: **CPU throttling 4×** (aproxima una gamma mitjana des del
desktop) i **Slow 4G** / **Offline** a la pestanya Network. Repeteix la traça de pan a la tauleta que
fan servir els tècnics per projectar.

### Deixa-ho escrit

Un fitxer amb data, commit, `eventId`/`segmentId` i els sis números (queries, ms d'API, bytes gzip,
ms fins a figures, long tasks, forced reflows). Sense això, després no sabràs si has millorat o
t'ho sembla.

## Ordre suggerit i condició de parada

Fet: baseline, F2.1–F2.3, F1, F5.1, F5.2 i F8 (vegeu *Implementat*). Queda, per ordre:

| # | Què | Per què | Esforç | Risc |
|---|-----|---------|--------|------|
| 1 | **Validar en un mòbil real i a la tauleta** (traça de pan/pinch, nitidesa del text amb `pixelRatio` 2) | El headless no reprodueix el pintat de GPU; decideix si cal seguir | Petit | Cap |
| 2 | **F7** — no tornar a consultar conflictes | Com que F6 no es fa, els conflictes continuen al payload; el classificador espera entitats i la projecció té DTOs | Petit–mitjà | Baix |
| 3 | ~~F6~~ | Descartat | — | — |
| 4 | **F3** — cache de mesures | Obligatori abans de F9; sense refresc automàtic no aporta res | Petit | Baix |
| 5 | **F4** — cache de la font a `FitText` | Només si una traça d'entrada ho demana; no és al gest | Mitjà | Mitjà |
| 6 | **F2.4** — contenidor únic amb `transform` | Només si un dispositiu real mostra *Layout* per frame | Mitjà | Alt |
| — | **F9** — refresc en directe | Més endavant; requereix F3 i un pressupost de peticions per IP | — | — |

**Fora d'aquest document però bloquejant per a la plaça:** verificar la IP que veu Caddy i el límit
de 10 req/min de `/api/auth*` (P1 de [[REQUEST_AUDIT]]).

---

*Veïns: [[PWA_UI]] · [[PINYES_MODULE]] · [[REQUEST_AUDIT]] · [[DEBT]] · [[AUDIT_SUITE]]*
