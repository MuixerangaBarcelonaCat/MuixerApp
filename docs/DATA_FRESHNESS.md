---
tags: [infra]
---

# Frescor de dades: Dashboard (tècnics) i PWA (membres)

**Data:** 05-10-2026 · **Branca base:** `develop` (`bf21368e`) · **Estat:** estudi, sense codi

Com mantenir actualitzades les assignacions de pinyes i l'assistència sense repetir el problema de
`fix/bugs-diversos-2` (SSE que carregava massa el servidor).

**Recomanació, en una frase:** no cal temps real per push. Un **comptador de revisió** a la base de dades
(mantingut per triggers de Postgres) i un **endpoint mínim que el retorna**. El Dashboard el consulta cada
~3 s mentre el workspace és visible; la PWA cada 30–35 s només a la pantalla de projecció i en dia d'event,
de manera que **un membre veu qualsevol canvi en 35 s com a màxim**. Només es descarreguen dades quan la
revisió ha canviat, i només la part que ha canviat.

---

## 1. Context i requisits

| Actor | On | Concurrència | Frescor necessària | Volum de canvis |
|---|---|---|---|---|
| Tècnics | Dashboard, workspace de segment | 1–5 alhora, de vegades el mateix segment o figura | Segons (≤ 3–5 s) | Alt en ràfegues (desenes d'assignacions per minut) |
| Membres | PWA, projecció del segment i «on sou» | 100+ alhora en dia d'actuació/assaig | **≤ 35 s** | Només llegeixen |
| Assistència | PWA (membre i «Passa llista»), Dashboard (confirmació) | Pics a l'arribada a l'assaig | Els tècnics la volen fresca (roster); per als membres és irrellevant a la projecció | Moltes escriptures petites |

Restriccions:

- **Un sol procés d'API** (`scripts/docker-entrypoint.sh`), pool de Postgres per defecte (**10** connexions),
  VPS Hetzner de 4 GB.
- **Límit per IP a Caddy**: `/api/*` 600 req/min. Tota la colla sovint comparteix IP (Wi-Fi del local, CGNAT
  del mòbil) — vegeu [[REQUEST_AUDIT]] §0.
- **Una projecció costa ~9 consultes** (`ProjectionService.getProjection`, `projection.service.ts:58-170`):
  inclou totes les assistències de l'event i llegeix les assignacions dues vegades. No hi ha cache.
- La **correcció ja està garantida al servidor**: `@Unique(['figureInstance','instanceNode'])` + 409
  `NODE_OCCUPIED` (també per a la carrera `23505`). La frescor és una qüestió d'UX, no d'integritat.

## 2. Què fa el codi ara

- **Dashboard:** el workspace carrega en entrar (`SegmentWorkspaceStateService.load()`, 7 peticions des de
  `e554c4ea`). No hi ha cap temporitzador. El canvas **no veu mai les assignacions d'un altre tècnic** fins
  que es torna a entrar. El roster (`available-persons`) es refresca en clicar un node si té més de 10 s
  (`person-panel.component.ts:31`, `:449`).
- **Quan hi ha col·lisió** (dos tècnics al mateix node): el client fa rollback i mostra «Este lloc ja està
  ocupat», però **no recarrega la instància** (`segment-assignment-actions.service.ts:228-238`): el tècnic
  continua sense veure qui l'ocupa.
- **PWA:** `rxResource` en entrar a la projecció i en prev/next; pull-to-refresh al detall de l'event. Sense
  `visibilitychange`, sense polling, sense `dataGroups` al service worker.
- **Assistència:** cap mutació d'assistència avisa ningú. `recalculateSummary` bloqueja i actualitza la fila
  de l'`Event` (`attendance.service.ts:217-238`).
- **Detecció barata de canvis:** no existeix. Les assignacions s'escriuen directament a `node_assignments`
  i cap `updatedAt` pare es mou; els esborrats no deixen rastre.

## 3. Per què l'SSE no era la solució

### 3.1 La idea en una imatge

- **SSE (push)** és com un **timbre**: cada vegada que un tècnic mou una persona, el servidor fa sonar el
  timbre a casa dels 120 membres, **tots alhora**, i tots corren a buscar la projecció sencera.
- **Polling de revisió (pull)** és com un **tauler d'anuncis**: cada membre hi dona una ullada cada ~30 s,
  cadascú en un moment diferent. Si el número de versió no ha canviat, se'n torna sense fer res.

Amb el timbre, **la feina del servidor creix amb el nombre de canvis**. Amb el tauler, **la feina està fixada
per l'interval**, facin els tècnics 1 canvi o 100.

### 3.2 La base tècnica

**1. L'SSE no estalvia la part cara.** L'SSE de la branca només enviava un avís («ha canviat alguna cosa»),
sense dades. Cada client havia de fer igualment la petició de la projecció (~9 consultes a Postgres). L'SSE no
elimina aquesta feina: només decideix *quan* es fa. I la fa en el pitjor moment possible.

**2. El cost es multiplica: canvis × oients.** Amb push, cada canvi genera feina a cada client connectat:

```
cost SSE     = canvis per minut × membres connectats × 9 consultes
cost polling = (membres / interval) × consulta mínima  (+ 1 projecció per membre només si hi ha hagut canvis)
```

Els tècnics treballen **a ràfegues**: just abans de l'actuació poden fer 20–30 canvis en un minut. És
exactament el moment en què l'SSE és més car, i també el moment en què els membres tenen més la PWA oberta.

**3. Efecte estampida (*thundering herd*).** L'SSE envia l'avís a tothom **en el mateix instant**. Els 120
mòbils demanen la projecció dins el mateix segon: 120 × 9 = **~1.080 consultes simultànies** contra un pool de
**10 connexions** a Postgres. Les peticions fan cua, les respostes tarden segons, i si en aquella cua entra
l'assignació d'un tècnic, **el tècnic també ho nota**. El polling amb *jitter* (cada mòbil a un segon diferent)
reparteix la mateixa feina al llarg de 30 s.

**4. L'assistència ho feia pitjor.** Marcar «Vinc» o «Passa llista» enviava un avís a **tot l'event**.
Durant l'arribada a un assaig, 60 persones marcant assistència = 60 timbres × 120 membres = **7.200
recàrregues de projecció** perquè sí, quan als membres l'assistència dels altres no els canvia res.

**5. Massa connexions obertes per a poc benefici.** Cada membre mantenia una connexió HTTP oberta de manera
permanent: memòria al procés de Node (socket, subscripció rxjs, temporitzador de *heartbeat* de 30 s) i una
connexió més a Caddy. En un servidor d'un sol procés i 4 GB, 100+ connexions que gairebé mai porten informació
útil són pes mort.

**6. Als mòbils, el «temps real» no existeix.** Quan el membre es guarda el mòbil a la butxaca, el navegador
suspèn la pestanya i talla la connexió. En tornar-lo a mirar, l'`EventSource` es reconnecta i **cal recarregar
igualment** perquè els avisos perduts no es guarden enlloc. És a dir, el cas més comú a la PWA (treure el mòbil
de la butxaca) ja l'havíem de resoldre amb «recarrega en tornar a la pantalla». Això és el polling, sense la
connexió permanent.

**7. Reconnexions en massa.** Si la Wi-Fi del local cau un moment, els 120 mòbils es reconnecten alhora i
**cadascun fa una recàrrega completa** per no perdre res: una altra estampida.

**8. Fragilitat amb l'autenticació.** `EventSource` no permet enviar capçaleres, per això el JWT anava a
`?token=`. El token dura 15 min; quan el navegador reconnectava sol, ho feia amb el token caducat → 401 → el
stream moria **en silenci** i el membre deixava de rebre canvis sense saber-ho. A més, Caddy comprimeix amb
`gzip` i pot retenir els missatges.

### 3.3 Detalls concrets de la implementació antiga

| Problema | On | Efecte |
|---|---|---|
| Canal per **event**, no per segment | `segment-events.service.ts` (un `Subject` per `eventId`) | Tothom rep tots els canvis; el filtre es fa al client quan ja s'ha enviat |
| L'assistència avisa tot l'event | `attendance.service.ts`, `me.service.ts` (`segmentIds: []`) | Recàrregues massives sense motiu |
| Recàrrega total, no parcial | `applyRemoteChange()` al Dashboard | **3 + 3·N peticions per pestanya**, també a la que ha fet el canvi |
| Consulta a BD per missatge i per membre | `narrowSegmentChangeForMember` → `findAllByEvent` | 120 consultes extra per cada canvi |
| Agrupació massa curta | 300 ms servidor + 400–700 ms client | Un tècnic que assigna cada 2 s genera una recàrrega a cada client cada 2 s |

### 3.4 Exemple numèric

Escenari: 120 membres amb la projecció oberta, un tècnic fa 20 canvis en un minut.

| | SSE (branca antiga) | Polling de revisió a 30–35 s |
|---|---|---|
| Peticions «hi ha canvis?» | 0 (però 120 connexions obertes) | ~220/min, cadascuna 1 `SELECT` d'una fila |
| Recàrregues de projecció | fins a 20 × 120 = **2.400** | com a màxim 2 per membre = **~240** |
| Consultes a Postgres per projeccions | ~21.600 | ~2.160 (o **~18** amb la cache de §5.4) |
| Com arriben | En pics de 1.080 consultes alhora | Repartides al llarg del minut |
| Retard per al membre | < 1 s (si la connexió segueix viva) | ≤ 35 s |

**Conclusió:** el problema és el *fan-out* (a quanta gent arriba cada canvi) multiplicat pel *cost de cada
recàrrega*. Per a 120 lectors que toleren 35 s de retard, empènyer cada canvi és pagar molt per una immediatesa
que no necessiten. Per als tècnics (≤ 5 persones) el càlcul és diferent, i per això l'SSE hi queda com a opció
futura (§6).

## 4. Opcions considerades

| Opció | Dashboard | PWA | Cost servidor | Complexitat | Veredicte |
|---|---|---|---|---|---|
| A. SSE com a la branca antiga | Instantani | Instantani | Molt alt (fan-out × refetch) | Alta | ❌ Descartada |
| B. WebSockets (socket.io) | Instantani | Instantani | Mateix problema que A si no es redueix fan-out | Molt alta (dependència nova, infra) | ❌ No aporta res sobre A |
| C. Polling de dades completes | Simple | Car: 100 × 9 consultes per interval | Alt a la PWA | Baixa | ❌ Per a la PWA |
| D. **Polling de revisió + refetch parcial** | ≤ 3 s | ≤ 35 s | Molt baix (1 SELECT indexat per petició) | Baixa-mitjana | ✅ **Recomanada** |
| E. SSE només tècnics, per segment, payload = revisió | < 1 s | — (usa D) | Baix (≤ 5 connexions) | Mitjana | 🔜 Millora futura si D no és prou ràpid |
| F. Push (Web Push ja existent) a qui li canvia la posició | — | Avís proactiu | Baix si hi ha debounce | Baixa (infra feta) | ➕ Opcional, complement de D |

## 5. Proposta recomanada (opció D)

### 5.1 Senyal de canvi: revisions a la BD, mantingudes per triggers

- `event_segments.revision INT NOT NULL DEFAULT 0` i `figure_instances.revision INT NOT NULL DEFAULT 0`.
- `events.attendance_revision INT NOT NULL DEFAULT 0`.
- **Triggers de Postgres** `AFTER INSERT/UPDATE/DELETE` a `node_assignments`, `instance_nodes` i
  `figure_instances` que fan `revision = revision + 1` a la instància i al segment afectats; i a `attendances`,
  que incrementa `events.attendance_revision`.

Per què triggers i no cridar un emissor des de cada servei (com feia `SegmentChangeEmitter`): la branca antiga
va haver de tocar ~15 punts de mutació a mà i afegir *joins* només per trobar l'`eventId`. Un trigger no es
deixa cap camí (swap, import massiu, reset, cordons, nodes ad hoc, migracions, scripts de reset) i viu en una
migració. El cost és un `UPDATE` d'una fila per escriptura; amb ≤ 5 tècnics la contenció sobre la fila del
segment és negligible. L'import massiu incrementa la revisió moltes vegades dins la mateixa transacció, però
el client només veu el valor final.

Alternativa sense columnes noves (`MAX(updated_at)` + `COUNT(*)` de `node_assignments` per segment): funciona,
però és més fràgil (ignora canvis a `instance_nodes`, depèn dels índexs) i no dona granularitat per instància.

### 5.2 Endpoints de revisió (molt barats)

- **Tècnics:** `GET /events/:eventId/segments/:segmentId/revision` →
  `{ segment: n, instances: { [id]: n }, attendance: n }`. Una consulta indexada; sense joins pesats.
- **Membres:** `GET /me/events/:eventId/segments/:segmentId/revision` → `{ segment: n }` (només si està
  publicat; 404 si no, igual que la projecció). **No inclou l'assistència**: als membres no els cal.

Poden retornar `ETag` = revisió i respondre `304` amb `If-None-Match`, però amb una resposta de pocs bytes no
és imprescindible.

### 5.3 Dashboard: polling de 3 s mentre el workspace és visible

- Interval de **3 s** (configurable) només amb el workspace obert **i** `document.visibilityState === 'visible'`;
  en tornar a ser visible, consulta immediatament.
- No consulta mentre hi ha una mutació pròpia en curs ni durant un arrossegament (es reprèn en acabar).
- Si canvia `instances[id]` → `refreshInstance(id)` **només d'aquella figura** (nodes + assignacions).
  Si canvia `segment` sense cap instància (crear/esborrar/moure figura) → `refresh()`.
  Si canvia `attendance` → recarrega el roster (substitueix la regla dels 10 s en clicar un node, o la complementa).
- **Ignorar el propi eco:** després d'una mutació pròpia, el client ja coneix la nova revisió; es pot
  retornar a la resposta de la mutació, o acceptar un `refreshInstance` redundant (barat, una sola figura).
- **409 `NODE_OCCUPIED` → `refreshInstance` immediat**, perquè el tècnic vegi qui ocupa el lloc. Aquest canvi
  és independent i val la pena encara que no es faci res més.
- «Previsualitza» (`ProjectionViewComponent` incrustat): refà la projecció només si canvia `segment` o
  `attendance` (resol també el P5 de [[REQUEST_AUDIT]]).

**Cost:** 5 tècnics × 20 consultes/min = **100 req/min** d'un SELECT trivial. Un refetch parcial (2–3 peticions)
només quan algú altre ha canviat alguna cosa. Pel límit de Caddy (600/min/IP), 5 tècnics a la mateixa Wi-Fi en
consumeixen ~1/6.

### 5.4 PWA: polling lent, només on importa

- **Només a `SegmentProjectionComponent`** i només si l'event és avui (o ±N hores de l'inici). Al detall de
  l'event, n'hi ha prou amb refrescar en entrar i en tornar a la pestanya.
- **Objectiu: un canvi arriba a qualsevol membre en ≤ 35 s.** Interval base de **30 s + jitter aleatori de
  0–5 s** a cada consulta. El jitter fa que 120 mòbils no consultin al mateix segon, i el màxim queda en 35 s
  (més el temps de descarregar la projecció, normalment < 1 s).
- Pausa amb la pestanya oculta; consulta immediata a `visibilitychange` → `visible` (el cas típic: el membre
  treu el mòbil de la butxaca i veu les dades al moment, sense esperar l'interval).
- Només si canvia la revisió → `projectionResource.reload()` (la projecció de ~9 consultes).
- **Agrupació natural:** encara que un tècnic faci 30 canvis en un minut, cada membre fa com a màxim **dues**
  recàrregues per minut. Aquest és el punt clau que la branca antiga no tenia.

**Cache de projecció per `(segmentId, revision)` — recomanada amb aquest interval.** La projecció no depèn de
qui la demana (el `highlightPersonId` es resol al client), així que tots els membres d'un segment poden rebre
el mateix resultat. Un `Map` en memòria al `ProjectionService` (una entrada per segment; es descarta quan la
revisió canvia) deixa el cost en **1 projecció per canvi i per segment**, sense importar quants membres hi
hagi. Funciona perquè l'API és un sol procés; si algun dia n'hi ha més, cada procés té la seva cache i continua
sent correcte.

**Cost amb 120 membres a la pantalla de projecció:**

| | Sense cache | Amb cache |
|---|---|---|
| Consultes de revisió | ~220/min (~3,7/s), 1 `SELECT` d'una fila cadascuna | igual |
| Projeccions en un minut amb canvis | ≤ ~220 (~3,7/s, repartides) ≈ 33 consultes/s | ≤ 2 per segment ≈ 18 consultes/min |
| Projeccions en un minut sense canvis | 0 | 0 |

Sense cache ja és assumible per al servidor (càrrega repartida, mai en pics). Amb cache és pràcticament nul·la.
Per tant, **35 s és un valor segur**; es podria baixar a ~15 s sense problema si la cache hi és.

**Risc a vigilar:** el límit per IP de Caddy. Amb 100+ mòbils a la Wi-Fi del local, ~220 req/min de revisió més
la navegació normal ocupen més d'un terç dels 600/min. **Cal pujar el límit de `/api/me/*`** o fer-lo per
usuari en lloc de per IP (ja era una recomanació de [[REQUEST_AUDIT]] §0).

### 5.5 Opcional: avís per push quan et canvien la posició (opció F)

La infraestructura de Web Push ja existeix (`push-notification`, concurrència limitada a 25). En lloc d'avisar
cada canvi, el tècnic pot prémer «Avisa dels canvis» al segment publicat, i s'envia una notificació només a les
persones amb `myPlacements` diferents des de l'últim avís. Evita la tempesta de canvis curts i dona control al
tècnic. No és necessari per a la frescor; és una millora de comunicació.

## 6. Quan passar a SSE (opció E)

Si a la pràctica 3 s és massa lent per als tècnics, el pas següent és un SSE **només per a TECHNICAL/ADMIN**,
**per segment**, que envia **només la revisió** (`{segment, instances}`) i el client aplica la mateixa lògica
de refetch parcial de 5.3. Cal arreglar el que va fallar: canal per segment, cap avís d'assistència als
membres, cap consulta a BD per missatge, reconnexió amb token nou (tancar i reobrir l'`EventSource` en
refrescar el JWT), `flush_interval -1` a Caddy i excloure `text/event-stream` del `gzip`. Els triggers de 5.1
es reutilitzen amb un `LISTEN/NOTIFY` de Postgres per alimentar el bus, de manera que no cal tocar els serveis.
La PWA continua amb polling: allà el temps real no aporta res i és on hi ha el volum.

## 7. Pla d'implementació suggerit

1. **409 → `refreshInstance`** al Dashboard (canvi petit, guany immediat).
2. Migració: columnes `revision` + triggers. Tests d'integració (testcontainers) que comprovin que assign,
   swap, unassign, import, reset, cordons i nodes ad hoc incrementen la revisió.
3. Endpoints de revisió (tècnic + membre).
4. Polling al workspace del Dashboard (3 s, visibilitat, refetch per instància, roster per `attendance`).
5. Polling a la projecció de la PWA (30 s + jitter 0–5 s, visibilitat, només el dia de l'event).
6. Cache de projecció per `(segmentId, revision)`.
7. Ajustar el límit de Caddy per a `/api/me/*`.
8. (Opcional) push «Avisa dels canvis»; SSE per a tècnics.

En acabar el pas 5, es pot esborrar l'element **A1** de [[DEBT]].

*Veïns: [[REQUEST_AUDIT]] · [[PINYES_MODULE]] · [[SSE_AUTH]] · [[DEBT]]*
