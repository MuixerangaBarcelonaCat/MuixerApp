---
tags: [qa]
---

# Auditoria de peticions al backend

**Data:** 23-09-2026 · **Branca:** `feat/optimize-request` · **Commit dels canvis:** `e554c4ea` (no fusionat)

La pantalla que més peticions fa és el **workspace de segments del Dashboard**
(`/pinyes/events/:eventId/segments/:segmentId/assign`). Obrir-ne un de 6 figures feia **29 peticions**;
amb el commit `e554c4ea` en fa **7**. La PWA de membres és lleugera (1–4 peticions per pantalla, sense
bucles per element).

Aquest document serveix per decidir què es fusiona. Els canvis ja estan commitejats en un sol commit, però
cada un dels cinc blocs de sota es pot revertir per separat.

**Recomanació:** fusionar els canvis 2.1, 2.2, 2.4 i 2.5, que no canvien res del que veu l'usuari.
Decidir el 2.3 (panell de persones) sabent que la llista deixa de refrescar-se a cada clic de node (vegeu §3).

## 0. Probable causa del límit, fora del codi

Caddy compta el límit per IP (`key {remote_host}` a `apps/dashboard/Caddyfile`):

- Tots els membres d'un assaig amb la mateixa wifi, o darrere el mateix CGNAT d'un operador mòbil,
  comparteixen **600 req/min** a `/api/*`.
- També comparteixen els **10 req/min de `/api/auth*`**, que inclou el refresh del token. Deu persones
  obrint la PWA alhora ja l'esgoten.
- `docker-compose.prod.yml` només exposa el port 80. Si davant de Caddy hi ha un altre proxy (TLS, túnel),
  `remote_host` és la IP del proxy i **tothom comparteix un sol comptador**.

Cal comprovar quina IP veu Caddy a producció (logs d'accés) abans de tocar més codi. Si és la del proxy, cal
`trusted_proxies` + `client_ip`. Si és la del NAT de l'assaig, cal apujar el límit de `/api/auth*` o
excloure'n `/api/auth/refresh`. No s'ha canviat res d'això.

## 1. Mesures

Mesurat en local amb Playwright, sobre el segment amb més figures de la BBDD de dev (6 figures, 64
assignacions), comptant les crides a `/api/*`.

| Acció | Abans | Després |
|---|---|---|
| Obrir el workspace (N figures) | 11 + 3N → **29** | **7** (fix, no depèn de N) |
| Canviar de pestanya Pinyes ↔ Troncs | 6 | 5 |
| Clicar un node | 1 | **0** |
| Teclejar l'alçada al panell de persones | 1 per tecla | **0** |
| Canviar el filtre Xicalla / etiqueta | 1 | **0** |
| Slider d'angle o X/Y/nom a Distribució | 1 PUT per tecla o per grau | **1** en aturar-se (400 ms) |
| Assignar una persona (comptat al codi, no mesurat) | 5–7 | 3–5 |

Queries a la BBDD per obrir el workspace: les crides per figura en feien ~4 cadascuna (≈24 per a 6
figures); l'endpoint nou en fa ~5 en total. `available-persons` en fa ~6 per crida i abans es cridava 3
vegades en obrir i 1 per clic; ara 1 vegada.

## 2. Canvis aplicats (commit `e554c4ea`)

### 2.1 Endpoint agregat `assignment-state`

- **Què:** `GET /events/:eventId/segments/:segmentId/assignment-state` retorna els nodes i les
  assignacions de totes les figures del segment. Reutilitza `getNodesByInstances` i
  `getAssignmentsByInstances`, que ja fa servir la projecció.
- **On:** `node-assignment.controller.ts`, `node-assignment.service.ts` (`getSegmentAssignmentState`).
- **Per què:** abans es feien 2 crides per figura (`/figure-instances/:id/nodes` i `/assignments`).
- **Guany:** 2N → 1 peticions i ~4N → ~5 queries.

### 2.2 Càrrega del workspace

- **Què:** `SegmentWorkspaceStateService.load()` hidrata totes les figures amb 2.1 i demana els conflictes
  una sola vegada.
- **Per què:** abans, cada resposta d'assignacions d'una figura tornava a demanar els conflictes (N+2 crides
  en total, totes amb el mateix resultat).
- `refreshInstance()` (després d'assignar, nodes extra, etc.) no canvia: continua sent per figura.

### 2.3 Panell de persones: filtres al client

- **Què:** `PersonPanelComponent` descarrega la plantilla sencera una vegada (`excludeAssigned=false`, sense
  filtres). Alçada, Xicalla i etiqueta s'apliquen al client (`filteredPersons`), amb la mateixa ordenació
  que el servidor: primer qui té alçada, després per proximitat.
- També s'elimina la càrrega de persones que feia `SegmentWorkspaceStateService`, que duplicava la del
  panell.
- **Per què:** abans hi havia 3 crides amb filtres diferents en obrir, 1 per cada clic de node (el filtre
  Xicalla es reaplicava encara que no canviés) i 1 per cada tecla del camp d'alçada.

### 2.4 Sense `refresh()` duplicat al primer muntatge

- **Què:** la primera pestanya que es munta després de `load()` no torna a fer `refresh()`. A partir del
  primer canvi de pestanya (`markTabSwitched()`), sí.
- **Per què:** Pinyes/Troncs/Nodes feien `refresh()` a `ngOnInit`, que repetia segments + distribució +
  conflictes just després de `load()`.

### 2.5 Distribució: desar amb debounce

- **Què:** les edicions del panell de propietats (X, Y, angle, nom) actualitzen el canvas a l'instant i es
  desen 400 ms després de l'última. Quan es tanca la pestanya, es desen les pendents. L'arrossegament al
  canvas continua desant immediatament.
- **Per què:** el slider d'angle enviava un `PUT /distribution` amb tot el segment per cada grau, i el camp
  de nom un `PUT` per cada tecla.

## 3. Canvien el comportament? Valoració d'UX

| Canvi | L'usuari nota alguna cosa? | Risc |
|---|---|---|
| 2.1 Endpoint agregat | No. Mateixes dades. | Baix |
| 2.2 Càrrega del workspace | Mínim: les figures apareixen totes alhora en comptes de una a una. | Baix |
| 2.3 Panell de persones | **Sí, la frescor de la llista** (vegeu sota). La resta, igual o millor. | **Mitjà** |
| 2.4 Sense refresh duplicat | No. Les dades de `load()` són de fa mil·lisegons. | Molt baix |
| 2.5 Debounce a Distribució | Un toast d'error com a màxim en lloc de molts. | Baix |

### 2.2 — detall

- El spinner espera els segments i també l'endpoint agregat. Abans el canvas apareixia amb els segments i
  les figures s'omplien una a una. Però el centrat de càmera ja esperava que totes estiguessin carregades
  (`instancesHydrated`), així que el primer frame útil arriba igual o abans.
- Si l'endpoint agregat falla, falla tot el workspace amb el toast «Error en carregar el segment.». Abans,
  si fallava una figura, les altres es mostraven igualment.

### 2.3 — detall (l'únic canvi amb impacte real)

- **Frescor:** abans, cada clic de node tornava a demanar la llista. Per tant, reflectia gairebé al moment
  les confirmacions d'assistència noves i les assignacions que feia **un altre tècnic** al mateix segment.
  Ara la llista es refresca en obrir la pestanya, després de cada acció pròpia (assignar, desassignar,
  desfer…) i amb el botó «Refrescar». Si hi ha dos tècnics treballant alhora al mateix segment, o membres
  confirmant mentre s'assigna, la llista pot quedar desfasada fins a la propera acció pròpia.
  - Mitigació possible si es vol mantenir el comportament anterior sense pagar-ne el cost: refrescar la
    llista en tornar el focus a la finestra, o com a molt una vegada cada 30–60 s en seleccionar un node.
- **Ordenació:** mateixa fórmula que el servidor. En cas d'empat (mateixa alçada), l'ordre ara és estable
  (per àlies); abans el decidia Postgres i podia variar.
- **Mode relatiu/absolut:** ara reordena la llista a l'instant; abans calia tornar a teclejar l'alçada.
- **Error corregit:** `state.confirmedPersons` rebia dues respostes (una sense xicalla i una amb). Si
  arribava l'última la de sense xicalla, les targetes de hover de la xicalla ja assignada quedaven buides.
  Ara sempre és la plantilla sencera.
- Verificat que el panell està sempre muntat a Pinyes i Troncs, també al mòbil (el modal projecta el
  contingut encara que estigui tancat). Per tant, els colors d'assistència del canvas es continuen omplint
  igual.

### 2.5 — detall

- Si es tanca la pestanya del navegador o es recarrega la pàgina menys de 400 ms després de l'última
  edició al panell, aquesta es perd. El canvi de pestanya del workspace i la navegació interna sí que la
  desen.
- En canviar de pestanya, el `PUT` pendent surt just abans del `refresh()` de la pestanya nova. Si el
  servidor resol primer el `GET`, la pestanya nova pot mostrar la posició anterior fins al següent refresh.
  Aquesta cursa ja existia abans, però amb una finestra més petita.

## 4. Pendent per valorar (no fet)

Ordenat per impacte estimat. Els recomptes surten de llegir el codi; els marcats amb * estan mesurats.

| # | On | Ara | Proposta | Esforç | Risc UX |
|---|---|---|---|---|---|
| P1 | Caddy, límit per IP (§0) | Tothom darrere un NAT o proxy comparteix 600 i 10 req/min | Verificar la IP real; `trusted_proxies`, o apujar/excloure `/api/auth/refresh` | Baix | Cap |
| P2 | Canvi de pestanya del workspace | 5 peticions* (segments, distribució, conflictes, `/tags`, persones) | Mantenir les pestanyes muntades, o refrescar només si una altra pestanya ha modificat alguna cosa | Mitjà | Baix |
| P3 | Assignar / desassignar / desfer | 3–5 peticions per acció | Que el POST/DELETE retorni els conflictes i els comptadors | Mitjà | Baix |
| P4 | Pestanya Distribució | Fa el seu propi `GET /distribution` en muntar-se i després de cada canvi de mode o cordons, tot i que el workspace ja el té | Llegir-lo de `ws.distributionByInstance` | Mitjà | Baix |
| P5 | Previsualitza | `GET /projection` sencer a cada activació | Cache fins que hi hagi una mutació | Baix | Baix |
| P6 | Imprimir esdeveniment (`event-print`) | 2 + S peticions (una projecció per segment) | Endpoint de projecció a nivell d'esdeveniment | Mitjà | Cap |
| P7 | Gestor de segments | «Publica-ho tot» = K `PUT`; afegir figures = M `POST` | Endpoints bulk | Mitjà | Cap |
| P8 | Detall d'esdeveniment (Dashboard) | `lock-status` espera que arribi `/events/:id` (cascada) | Llançar-los en paral·lel | Molt baix | Cap |
| P9 | Inici de la PWA | 2 × `GET /me/events?limit=1` (assaig i actuació) | Una sola crida que retorni «pròxim de cada tipus» | Baix | Cap |
| P10 | `/tags` al panell de persones | 1 per muntatge de pestanya | Cache al servei (canvia molt poc) | Molt baix | Cap |

Error trobat de passada, no corregit: la pestanya Previsualitza, quan està incrustada al workspace, llegeix
`route.snapshot.params`. Si canvies de segment amb anterior/següent sense sortir-ne, continua mostrant el
segment anterior (`projection-view.component.ts`).

## 5. Com s'ha mesurat i com revertir

- **Mesura:** Playwright en local (API + Dashboard), amb login una sola vegada i navegació client-side
  (pushState), comptant `page.on('request')` a `/api/*`. Segment de proves:
  `ba08ad28-…/dbbef4ca-…` (6 figures).
- **Tests:** API 1234 tests en verd, Dashboard 103 fitxers en verd. S'han actualitzat els specs de
  `person-panel`, `segment-workspace-state`, `distribucio-tab` i els mocks de les pestanyes.
- **Revertir un bloc:** el commit `e554c4ea` els conté tots. Per treure'n només un, cal revertir els fitxers
  del bloc:
  - 2.3: `person-panel.component.ts` + spec, i restaurar `loadConfirmedPersons` a
    `segment-workspace-state.service.ts`.
  - 2.5: `distribucio-tab.component.ts` + spec.
  - 2.1 i 2.2 van junts: el frontend depèn de l'endpoint nou.

*Veïns: [[PINYES_MODULE]] · [[PWA_RENDER_PERF]] · [[AUTH_FLOW]] · [[DOCKER_SETUP]]*
