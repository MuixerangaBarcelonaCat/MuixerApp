# PWA — Eines per a Tècnic/Admin — Design Spec

**Date:** 2026-08-28
**Status:** Approved
**Scope:** API + PWA

---

## Summary

Afegir dues eines noves a la PWA, visibles només per TECHNICAL/ADMIN, per a gestió in situ (al lloc de l'assaig/actuació, sense obrir el Dashboard):

1. **Passar llista** — marcar assistència (ANIRE/NO_VAIG/ASSISTIT) de qualsevol persona convocada a un event, des de dins la pantalla d'event.
2. **Vista suplantada (read-only)** — buscar una persona i veure la seua projecció de segment (on va col·locada) exactament com la veuria ella, per quan no té el mòbil a mà.

Cap canvi de model de dades. Cap endpoint d'assistència nou (es reaprofiten els existents). Un únic endpoint nou, de lectura, per generalitzar la projecció d'un segment a un `personId` arbitrari.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Abast passar llista | Tots els membres convocats a l'event (no només delegats) |
| Endpoints d'assistència | Reaprofitar `GET/POST/PUT /events/:id/attendance*` (ja TECHNICAL/ADMIN) — cap endpoint nou |
| Abast vista suplantada | Read-only. Cap acció (ni assistència) s'envia en nom de la persona suplantada |
| Endpoint de suplantació | Generalitzar `GET /me/events/:eventId/segments/:segmentId/projection` i `GET /me/events/:eventId/segments` amb `personId` opcional (TECHNICAL/ADMIN only) |
| Auditoria | Cap, en esta fase (és lectura de dades ja internes a la colla) |
| Ubicació navegació | Dins `event-detail`, no una pestanya nova al bottom-tab-bar |
| Altres funcions (alta delegat, push manual) | Fora d'abast — es valoraran en una fase posterior |

---

## 1. Backend — `event` module (passar llista)

Sense canvis. La PWA consumeix directament el que ja usa `attendance-list` del Dashboard:

- `GET /events/:id/attendance` (`AttendanceFilterDto`: status/search/positionIds) → `AttendanceItem[]` paginat.
- `POST /events/:id/attendance` (`CreateAttendanceDto`: `personId`, `status`, `notes?`) — 409 si ja existeix.
- `PUT /events/:id/attendance/:attendanceId` (`UpdateAttendanceDto`: `status?`, `notes?`).

Guard existent: `@Roles(UserRole.TECHNICAL, UserRole.ADMIN)` a nivell de controller (`event.controller.ts`).

---

## 2. Backend — `me` module (vista suplantada)

### Canvi: `personId` opcional per a TECHNICAL/ADMIN

Dos endpoints existents guanyen un query param opcional `personId`:

- `GET /me/events/:eventId/segments?personId=<uuid>`
- `GET /me/events/:eventId/segments/:segmentId/projection?personId=<uuid>`

**Regla d'autorització a `MeService`:**

- Si `personId` no s'envia → comportament actual (self + delegats via `resolveManagedPersons`).
- Si `personId` s'envia:
  - `jwtUser.role` és `MEMBER` → **ignorat si no és un dels seus `managedPersons`**; si no en forma part, `403 Forbidden` (evita que un membre "suplante" qualsevol persona canviant l'URL).
  - `jwtUser.role` és `TECHNICAL`/`ADMIN` → s'usa directament eixe `personId`, sense passar pel filtre de `managedPersons`.

Implementació: a `findEventSegments` i al punt on `ProjectionService.getProjection` calcula `myPlacements`/`highlightPersonId` intern, substituir "el personId ve sempre de `resolveManagedPersons(jwtUser.sub)`" per la lògica anterior. No toca `ProjectionService` (continua rebent un `personId` ja resolt).

**DTO:** afegir `personId?: string` (`@IsOptional() @IsUUID()`) al query DTO existent d'estos dos endpoints.

No cal nou mòdul ni controller: mateix `me.controller.ts`, mateix `@Roles(MEMBER, TECHNICAL, ADMIN)` (el 403 intern cobreix la restricció fina per a MEMBER).

---

## 3. Frontend PWA — Passar llista

### Ubicació

Nova secció dins `EventDetailComponent`, visible només si `authService.userRole()` és `TECHNICAL`/`ADMIN`. Un botó/enllaç "Passar llista" que obri una vista (ruta filla o modal a pantalla completa, com `SegmentProjectionComponent` ja fa amb fullscreen).

### Component nou: `RollCallComponent` (`features/events/roll-call/`)

- Carrega `GET /events/:id/attendance` en obrir (reutilitza `AttendanceService`-equivalent a la PWA, o se'n crea un de mínim si no existeix cap servei d'assistència admin al costat PWA).
- Llista de persones amb: nom, estat actual (badge), cerca per nom (`filter` client-side, la llista d'una colla és menuda).
- Per fila: 3 botons compactes ANIRE/NO_VAIG/ASSISTIT (patró `pill-badge`/`lib-button` del design system, mai HTML cru).
- Tap sobre un botó → `POST` (si no hi ha registre) o `PUT` (si ja n'hi ha) contra `/events/:id/attendance*`, actualització optimista + reload de la fila.
- Sense paginació pròpia (event típic: desenes de persones, no centenars) — llista completa amb cerca client-side.

### Error handling

- 409 en `POST` → reintenta amb `PUT` sobre l'`attendanceId` ja existent (mateix patró que fa `attendance-list` del Dashboard, si el fa; si no, capturar 409 i refer un `GET` puntual per obtindre l'id).

---

## 4. Frontend PWA — Vista suplantada

### Entrada

Dins `EventDetailComponent` (secció TECHNICAL/ADMIN), un cercador de persona ("Veure com..."). En triar una persona:

1. Navega a la mateixa ruta de `SegmentProjectionComponent` (o llista de segments si n'hi ha més d'un) però amb un query param `?asPerson=<personId>`.
2. El component crida `GET /me/events/:eventId/segments(/:segmentId/projection)?personId=<personId>` en compte de l'endpoint sense param.
3. Banner superior fix "Veient com: {nom de la persona}" (usa `OwnPositionBannerComponent`/estil similar, no un component nou si l'existent s'hi adapta amb un `@Input`/`input()` de nom mostrat).
4. `highlightPersonId` passat a `<lib-pinya-projection>` és el `personId` triat, no el de l'usuari autenticat.
5. **Read-only garantit per disseny**: no es renderitza cap `AttendanceButton` ni acció d'escriptura en este mode — el component ja no en té dins de `SegmentProjectionComponent`, així que no cal ocultar res explícitament més enllà del banner.

### Reutilització

Cap component Konva nou. `SegmentProjectionComponent` i `PinyaProjectionComponent` (`@muixer/pinyes-render`) ja accepten `highlightPersonId`; només cal parametritzar d'on ix eixe id (JWT vs. persona triada) i quin `personId` s'envia a l'API.

---

## 5. Guarda de rol i visibilitat

- Ambdues seccions noves a `EventDetailComponent` es mostren només si `authService.userRole()` és `TECHNICAL` o `ADMIN` (patró `*ngIf`/`@if` ja usat al Dashboard per a seccions condicionades per rol).
- No cal nou `rolesGuard` de ruta: `EventDetailComponent` ja és accessible per TECHNICAL/ADMIN/MEMBER; la restricció és a nivell de secció dins la pàgina, no de ruta.

---

## 6. Testing

- **Backend (`me.service.spec.ts`):** casos nous — TECHNICAL amb `personId` arbitrari → OK; MEMBER amb `personId` fora dels seus `managedPersons` → 403; MEMBER amb `personId` d'un delegat seu → OK (comportament actual intacte); cap `personId` → comportament actual intacte.
- **Frontend (`roll-call.component.spec.ts`):** render de llista, canvi d'estat dispara `POST`/`PUT` correcte, filtre de cerca.
- **Frontend (projecció suplantada):** `SegmentProjectionComponent` amb `asPerson` present crida l'endpoint amb `personId`, banner mostra el nom correcte.

---

## Fora d'abast (fase posterior, si cal)

- Alta ràpida de delegat/xicalla in situ.
- Notificació push manual des de la PWA.
- Auditoria d'obertura de vista suplantada.
- Cerca/lookup d'assignació creuant tots els segments d'un event sense entrar-hi un a un (la suplantació ja cobreix el cas d'ús real plantejat).

---

*Veïns: [[AUTH_FLOW]], [[PINYES_MODULE]], [[DASHBOARD_UI]]*
