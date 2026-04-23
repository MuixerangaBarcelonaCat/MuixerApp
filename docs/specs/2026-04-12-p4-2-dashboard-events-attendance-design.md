# P4.2: Dashboard Web — Events CRUD + Manual Attendance Management

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Full event CRUD from the Dashboard, manual attendance editing/creation/deletion, provisional persons, and attendance-related UX enhancements.
**Depends on:** P4.1 (Auth Layer — complete), P3 (Seasons + Events + Attendance entities — complete)

---

## 1. Context

The Dashboard already displays events (list + detail) and attendance (read-only table). Technicians can only edit `countsForStatistics` and `seasonId` on events. There is no way to create or delete events, nor to manage attendance records manually.

In practice, technicians need to:
- Create events for rehearsals and performances that don't come from the legacy sync
- Edit all event fields (not just two)
- Delete events that were created by mistake (only if they have no attendance)
- Manually set attendance status for members (e.g., mark someone who said "I'm coming" but didn't show up)
- Add attendance for members who didn't register via the legacy system
- Add attendance for **new people** who come to try the activity and are not yet in the system (provisional persons)
- Delete erroneous attendance records

### What this slice covers

- **Backend Event CRUD:** `POST /events`, `PUT /events/:id` (all fields), `DELETE /events/:id` (blocked if has attendance)
- **Backend Attendance CRUD:** `POST`, `PATCH`, `DELETE` on `/events/:id/attendance`
- **Automatic `attendanceSummary` recalculation** after every attendance mutation, returned in the response
- **Provisional Persons:** new `isProvisional` boolean on `Person`, prefix `~` alias convention, quick-add flow from attendance context, retroactive marking
- **Dashboard Event Form Modal:** create + edit events (reusable modal component)
- **Dashboard Attendance Edit Modal:** edit status + notes + delete, with statistics impact warning
- **Dashboard Add Attendance:** person search autocomplete + add provisional person flow
- **Dashboard Filter Preset:** quick "Confirmats" filter for attendance table
- **Person list enhancements:** provisional filter, provisional badge

### What this slice does NOT cover

- `manuallyOverridden` flag on Attendance (deferred — YAGNI)
- Event metadata editing (RehearsalMetadata / PerformanceMetadata fields in the form — deferred)
- Bulk attendance operations (select multiple → change status)
- Dashboard visual refactor (separate future effort)
- PWA member self-service attendance (P6)
- Season CRUD (read-only, sufficient for now)

---

## 2. Architecture Overview

```
┌──────────────────────────────────┐       ┌────────────────────────────────────┐
│  Angular Dashboard               │       │           NestJS API                │
│                                  │       │                                    │
│  EventListComponent              │       │  EventController                   │
│    ├─ "Nou event" → modal ───────┼──POST─┼→ POST /events                     │
│    └─ navigate to detail         │       │                                    │
│                                  │       │                                    │
│  EventDetailComponent            │       │                                    │
│    ├─ "Editar" → modal ──────────┼──PUT──┼→ PUT /events/:id                  │
│    ├─ "Eliminar" → confirm ──────┼──DEL──┼→ DELETE /events/:id               │
│    │                             │       │    └─ 409 if has attendance        │
│    ├─ Attendance table           │       │                                    │
│    │   ├─ click badge → modal ───┼─PATCH─┼→ PATCH /events/:id/attendance/:aId│
│    │   │   └─ delete from modal ─┼──DEL──┼→ DELETE  "                        │
│    │   └─ "Afegir membre"        │       │                                    │
│    │       ├─ search persons ────┼──GET──┼→ GET /persons?search=x            │
│    │       ├─ add attendance ────┼──POST─┼→ POST /events/:id/attendance      │
│    │       └─ add provisional ───┼──POST─┼→ POST /persons (provisional)      │
│    │                             │       │    + POST /events/:id/attendance   │
│    └─ "Confirmats" preset filter │       │                                    │
│                                  │       │  All mutations trigger:            │
│  PersonSearchInputComponent      │       │    recalculateSummary(eventId)     │
│    (shared, reusable)            │       │    → returns updated summary       │
└──────────────────────────────────┘       └────────────────────────────────────┘
```

---

## 3. Backend — Event CRUD

### 3.1 New Endpoints

| Method | Route | Auth | Description | Response |
|--------|-------|------|-------------|----------|
| `POST` | `/events` | TECHNICAL, ADMIN | Create event | `201` → `EventDetailItem` |
| `PUT` | `/events/:id` | TECHNICAL, ADMIN | Update all fields | `200` → `EventDetailItem` |
| `DELETE` | `/events/:id` | TECHNICAL, ADMIN | Delete event | `204` No Content |

### 3.2 CreateEventDto

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `title` | string | ✅ | `@IsNotEmpty()`, `@MaxLength(200)` |
| `eventType` | EventType | ✅ | `@IsEnum(EventType)` |
| `date` | string | ✅ | `@IsDateString()` |
| `startTime` | string | | `@Matches(/^\d{2}:\d{2}$/)` — HH:mm |
| `location` | string | | `@IsOptional()`, `@MaxLength(200)` |
| `locationUrl` | string | | `@IsOptional()`, `@IsUrl()` |
| `description` | string | | `@IsOptional()` |
| `information` | string | | `@IsOptional()` |
| `countsForStatistics` | boolean | | `@IsOptional()`, `@IsBoolean()` — default `true` |
| `seasonId` | string | | `@IsOptional()`, `@IsUUID('4')` — validates Season exists |

### 3.3 UpdateEventDto

`PartialType(CreateEventDto)` — all fields optional. Replaces the current `UpdateEventDto` which only accepted `countsForStatistics` and `seasonId`.

The existing `PATCH /events/:id` route changes to `PUT /events/:id`. The controller method updates all provided fields on the event entity.

### 3.4 Delete Logic

```
EventService.remove(id):
  1. Find event by ID (404 if not found)
  2. Count attendances for event
  3. If count > 0 → throw ConflictException("No es pot eliminar un event amb registres d'assistència. Elimina primer els registres.")
  4. If count === 0 → hard delete → return void
```

Controller returns `204 No Content` on success.

---

## 4. Backend — Attendance CRUD

### 4.1 New Endpoints

| Method | Route | Auth | Description | Response |
|--------|-------|------|-------------|----------|
| `POST` | `/events/:id/attendance` | TECHNICAL, ADMIN | Create attendance record | `201` → `{ attendance, summary }` |
| `PATCH` | `/events/:id/attendance/:attendanceId` | TECHNICAL, ADMIN | Update status + notes | `200` → `{ attendance, summary }` |
| `DELETE` | `/events/:id/attendance/:attendanceId` | TECHNICAL, ADMIN | Delete record | `200` → `{ summary }` |

### 4.2 CreateAttendanceDto

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `personId` | string | ✅ | `@IsUUID('4')` — validates Person exists |
| `status` | AttendanceStatus | ✅ | `@IsEnum(AttendanceStatus)` |
| `notes` | string | | `@IsOptional()` |

On duplicate (person+event UNIQUE constraint): catch DB error → `409 Conflict` with message "Aquesta persona ja té registre d'assistència per aquest event".

### 4.3 UpdateAttendanceDto

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `status` | AttendanceStatus | | `@IsOptional()`, `@IsEnum(AttendanceStatus)` |
| `notes` | string \| null | | `@IsOptional()` — `null` clears the note |

### 4.4 Mutation Flow (all three operations)

```
1. Validate event exists (404 if not found)
2. Execute operation (create / update / delete)
   - On create/update: set respondedAt = new Date()
3. Call recalculateSummary(eventId)  // already exists in AttendanceService
4. Fetch updated summary from event
5. Return { attendance, summary } or { summary } for delete
```

The `recalculateSummary` method already exists and recounts all statuses + children. No changes needed to its logic.

### 4.5 Response Shape

```typescript
// POST and PATCH
{
  attendance: AttendanceItem,   // same shape as GET attendance list items
  summary: AttendanceSummary    // updated event summary
}

// DELETE
{
  summary: AttendanceSummary    // updated event summary after removal
}
```

This allows the frontend to update both the attendance list and the summary card without a full reload.

---

## 5. Provisional Persons

### 5.1 Model Change

Add to `Person` entity:

```typescript
@Column({ type: 'boolean', default: false })
isProvisional: boolean;
```

TypeORM migration: `ALTER TABLE persons ADD COLUMN "isProvisional" boolean NOT NULL DEFAULT false;`

### 5.2 Alias Convention

- Provisional persons have alias prefixed with `~` (e.g., `~Joan`)
- The `~` prefix guarantees no collision with regular aliases (UNIQUE constraint on `alias` is preserved)
- Regular person creation validates that alias does NOT start with `~`
- When promoting a provisional person to regular, the technician assigns a definitive alias (validated as unique among all persons)

### 5.3 Relaxed Validation for Provisionals

The existing `CreatePersonDto` requires `name` and `firstSurname`. For provisional creation, a separate endpoint or conditional validation is needed:

**New endpoint:** `POST /persons/provisional`

| Field | Type | Required | Validation |
|-------|------|:--------:|------------|
| `alias` | string | ✅ | `@IsNotEmpty()`, `@MaxLength(19)` — system prepends `~` |

Backend logic:
```
1. Prepend "~" to alias
2. Validate "~alias" is unique (409 if taken)
3. Create Person with:
   - alias: "~" + input alias
   - name: input alias (placeholder)
   - firstSurname: "" (empty string)
   - isProvisional: true
   - isActive: true
4. Return created Person
```

### 5.4 Promoting a Provisional Person

Handled via the existing `PATCH /persons/:id` (UpdatePersonDto). The technician:
1. Fills in real `name`, `firstSurname`, and other fields
2. Sets a new `alias` (without `~` prefix)
3. Sets `isProvisional = false`

Validation: when `isProvisional` transitions from `true` to `false`, `name` and `firstSurname` must be non-empty and `alias` must not start with `~`.

### 5.5 Retroactive Provisional Marking

Existing persons can be marked as provisional via `PATCH /persons/:id` with `{ isProvisional: true }`. When this happens:
- The alias is automatically prefixed with `~` (if not already)
- If prefixing `~` would exceed the 20-char alias limit, the alias is truncated to fit (e.g., `LlorençGarcíaMartín` → `~LlorençGarcíaMarti`)
- The person disappears from the default census view
- Their attendance records remain unchanged and count for statistics

### 5.6 Person List Filtering

Add `isProvisional` to `PersonFilterDto`:

```typescript
@IsOptional()
@IsBoolean()
@Type(() => Boolean)
isProvisional?: boolean;
```

Default behavior: `GET /persons` without the parameter returns **all persons** (backwards compatible). The Dashboard applies `isProvisional=false` as default filter in the UI.

---

## 6. Dashboard — Event Form Modal

### 6.1 Component

```
features/events/components/event-form-modal/
├── event-form-modal.component.ts
├── event-form-modal.component.html
└── event-form-modal.component.scss
```

### 6.2 Inputs / Outputs

```typescript
event = input<EventDetail | null>(null);   // null = create, value = edit
seasons = input<Season[]>([]);
saved = output<EventDetail>();
closed = output<void>();
```

### 6.3 Form Fields

| Field | Control | Required | Notes |
|-------|---------|:--------:|-------|
| Títol | input text | ✅ | maxlength 200 |
| Tipus | select (Assaig / Actuació) | ✅ | Disabled in edit mode |
| Data | input date | ✅ | |
| Hora inici | input time | | HH:mm |
| Ubicació | input text | | |
| URL ubicació | input url | | Visible only if location has value |
| Temporada | select | | Season list |
| Compta estadístiques | toggle | | Default `true` |
| Descripció | textarea | | |
| Informació | textarea | | |

Uses `ReactiveFormsModule`. Validation messages shown inline (DaisyUI `input-error` class).

### 6.4 Modal UX

- Opens via native `<dialog>` element with DaisyUI modal classes
- Title adapts to context: "Nou assaig" / "Nova actuació" / "Editar assaig" / "Editar actuació"
- Buttons: "Cancel·lar" (btn-ghost) + "Crear" or "Desar" (btn-primary)
- Loading spinner on submit button during API call
- On success: emits `saved` with the returned `EventDetailItem`, closes modal
- On error: shows error alert inside modal

### 6.5 Integration

**Event list:**
- New button "Nou esdeveniment" (`btn btn-primary btn-sm`) in the header bar
- Opens modal in create mode
- On `saved`: reloads event list

**Event detail:**
- Existing "Editar" button opens modal in edit mode (replaces the current inline edit panel)
- Remove: `isEditing` signal, `startEdit()`, `cancelEdit()`, `saveEdit()`, `editCountsForStats`, `editSeasonId` — all replaced by the modal
- New "Eliminar" button (`btn btn-error btn-outline btn-sm`) next to "Editar"
- Delete flow: DaisyUI confirm dialog → `DELETE /events/:id` → on success: navigate to list. On 409: show alert with backend message.

---

## 7. Dashboard — Attendance Edit Modal

### 7.1 Component

```
features/events/components/attendance-edit-modal/
├── attendance-edit-modal.component.ts
├── attendance-edit-modal.component.html
└── attendance-edit-modal.component.scss
```

### 7.2 Inputs / Outputs

```typescript
attendance = input.required<AttendanceItem>();
isPast = input(false);
saved = output<{ attendance: AttendanceItem; summary: AttendanceSummary }>();
deleted = output<AttendanceSummary>();
closed = output<void>();
```

### 7.3 Modal Layout

```
┌─────────────────────────────────────────┐
│ Editar assistència                      │
│ ─────────────────                       │
│ 🏷️ Joan "Pitu" García                  │
│                                         │
│ Estat:                                  │
│ ┌─────────┐ ┌────────┐ ┌─────────────┐ │
│ │ 🟢 Aniré│ │🔴 No   │ │ ⚪ Sense    │ │
│ │         │ │  vaig   │ │  resposta   │ │
│ └─────────┘ └────────┘ └─────────────┘ │
│ ┌───────────┐ ┌──────────────┐         │
│ │ ✅ Assistit│ │ 🟡 No        │         │
│ │           │ │  presentat   │         │
│ └───────────┘ └──────────────┘         │
│                                         │
│ ⚠️ Canviar l'estat d'un event passat   │
│    afecta les estadístiques.            │
│                                         │
│ Notes:  ┌──────────────────────┐        │
│         │                      │        │
│         └──────────────────────┘        │
│                                         │
│ [🗑️ Eliminar]       [Cancel·lar][Desar]│
└─────────────────────────────────────────┘
```

### 7.4 Status Selection

- **Button-group with colors** instead of dropdown — each `AttendanceStatus` is a toggle button with a distinct color:
  - `ANIRE` → green (`btn-success`)
  - `NO_VAIG` → red (`btn-error`)
  - `PENDENT` → ghost/neutral (`btn-ghost`)
  - `ASSISTIT` → green outline (`btn-success btn-outline`) — only shown for past events
  - `NO_PRESENTAT` → amber/warning (`btn-warning`) — only shown for past events
- Selected button is filled (solid); unselected are outline
- Labels adapt to past/future context (same as `getStatusLabel` in current code)

### 7.5 Statistics Impact Warning

When the event is past (`isPast = true`) and the user changes the status to a different value, show a warning:

> ⚠️ "Canviar l'estat d'un event passat afecta les estadístiques d'assistència."

The warning is visible whenever `isPast && selectedStatus !== originalStatus`. Not a blocker — just informational awareness. It disappears if the user reverts to the original status.

### 7.6 "Desar" Button Activation

- "Desar" button is **disabled** by default
- Becomes enabled when status OR notes differ from the original values
- Visual: `btn-primary` when enabled, `btn-disabled` when not

### 7.7 Delete from Modal

- "Eliminar" button (`btn-error btn-outline btn-sm`) at the bottom-left of the modal
- Clicking shows inline confirmation within the modal: "Segur que vols eliminar aquest registre?" with "Sí, eliminar" (`btn-error btn-sm`) and "No" (`btn-ghost btn-sm`)
- On confirm: `DELETE /events/:id/attendance/:attendanceId` → emits `deleted` with updated summary

### 7.8 Integration with Event Detail

- The status badge in the attendance table becomes clickable: `cursor-pointer` + `hover:opacity-80`
- Clicking opens the modal with the corresponding `AttendanceItem`
- **Optimistic local update:** when modal emits `saved`, the component updates the attendance item in the local signal array and patches the event's `attendanceSummary` — without reloading the full list. A code comment explains this pattern for future iterations:

```typescript
// Optimistic local update: we patch the attendance list and summary
// in-place from the API response instead of reloading the full list.
// This avoids a network round-trip and keeps the UX snappy.
// If the local state ever drifts, a full page reload corrects it.
```

- When modal emits `deleted`, the attendance item is removed from the local array and summary is updated with the same optimistic pattern.

---

## 8. Dashboard — Add Attendance

### 8.1 Shared Component: PersonSearchInputComponent

```
shared/components/forms/person-search-input/
├── person-search-input.component.ts
├── person-search-input.component.html
└── person-search-input.component.scss
```

**Inputs:**
- `placeholder = input('Cerca un membre...')`
- `excludeIds = input<string[]>([])` — hides persons already in the attendance list

**Outputs:**
- `selected = output<PersonRef>()` — emits when user picks a person from results

**Behavior:**
- Debounced input (300ms) → `GET /persons?search=xxx&limit=10&isActive=true`
- Dropdown with results: `alias — nom cognom`
- Provisional persons shown with 🏷️ badge
- Excludes persons whose ID is in `excludeIds`
- On select: emits `selected`, clears input

### 8.2 Add Attendance Bar

Inline bar within the attendance card header (not a modal):

```
┌──────────────────────────────────────────────────────┐
│ [🔍 Cerca un membre...     ] [▼ Estat] [Afegir]     │
│                              [+ Persona nova]        │
└──────────────────────────────────────────────────────┘
```

- **Person search:** `PersonSearchInputComponent` with `excludeIds` set to current attendance person IDs
- **Status select:** default depends on event timing:
  - Future event (not started): `ANIRE` — label "Aniré"
  - Past event (already happened): `ASSISTIT` — label "Ha vingut"
- **"Afegir" button:** `POST /events/:id/attendance` with `{ personId, status }` → adds to local list + updates summary
- **"Persona nova" button:** opens the provisional person quick-add flow (see 8.3)

### 8.3 Quick-Add Provisional Person

When the technician clicks "+ Persona nova":

1. Input field appears: "Àlies de la persona nova" (required)
2. Status select: same default as regular add (ANIRE or ASSISTIT based on event timing)
3. "Crear i afegir" button:
   - `POST /persons/provisional` with `{ alias }` → returns new Person
   - `POST /events/:id/attendance` with `{ personId: newPerson.id, status }` → returns attendance + summary
   - Both calls sequential (person must exist before attendance)
4. On success: new attendance appears in the list, summary updates
5. On error (409 alias taken): show message "Aquesta àlies ja existeix. Prova amb un altre."

---

## 9. Dashboard — Confirmed Filter Preset

### 9.1 Behavior

A toggle button added next to the existing status filter dropdown in the attendance section:

- Button: `btn btn-outline btn-xs` with label "Confirmats"
- Click → applies filter:
  - Future event: `status = ANIRE`
  - Past event: `status = ASSISTIT`
- Click again → clears filter (toggle behavior)
- Reuses existing `onAttendanceStatusFilter` mechanism — no new logic, just a shortcut button

---

## 10. Dashboard Services — Changes

### 10.1 EventService (Dashboard)

Add methods:

```typescript
create(payload: CreateEventPayload): Observable<EventDetail>
  // POST /events

updateFull(id: string, payload: UpdateEventPayload): Observable<EventDetail>
  // PUT /events/:id — replaces current update() method

delete(id: string): Observable<void>
  // DELETE /events/:id
```

Update `UpdateEventPayload` interface to include all editable fields (title, date, startTime, location, etc.).

Add `CreateEventPayload` interface with required + optional fields.

### 10.2 AttendanceService (Dashboard)

Add methods:

```typescript
create(eventId: string, payload: CreateAttendancePayload): Observable<AttendanceResponse>
  // POST /events/:eventId/attendance

update(eventId: string, attendanceId: string, payload: UpdateAttendancePayload): Observable<AttendanceResponse>
  // PATCH /events/:eventId/attendance/:attendanceId

delete(eventId: string, attendanceId: string): Observable<{ summary: AttendanceSummary }>
  // DELETE /events/:eventId/attendance/:attendanceId
```

### 10.3 PersonService (Dashboard)

Add method:

```typescript
createProvisional(alias: string): Observable<PersonRef>
  // POST /persons/provisional
```

---

## 11. Person List Enhancements

### 11.1 Dashboard Filter

Add a census filter to the person list filter bar:

- Selector with three options: "Cens" (default) / "Provisionals" / "Tots"
- "Cens" → `isProvisional=false`
- "Provisionals" → `isProvisional=true`
- "Tots" → no isProvisional param

### 11.2 Provisional Badge

In the person table row: if `isProvisional === true`, show badge `🏷️ Provisional` next to the alias.

In the person detail: same badge + action button to toggle provisional status.

---

## 12. Testing Strategy

### 12.1 Backend Tests (Jest)

**Event CRUD:**
- `POST /events` — valid creation, missing required fields (400), invalid eventType (400), invalid seasonId (404)
- `PUT /events/:id` — update all fields, partial update, event not found (404), invalid seasonId (404)
- `DELETE /events/:id` — delete empty event (204), delete event with attendance (409), event not found (404)

**Attendance CRUD:**
- `POST /events/:id/attendance` — valid creation, person not found (404), event not found (404), duplicate person+event (409), summary recalculated
- `PATCH /events/:id/attendance/:aId` — update status, update notes, clear notes (null), attendance not found (404), summary recalculated
- `DELETE /events/:id/attendance/:aId` — delete success, attendance not found (404), summary recalculated

**Provisional Persons:**
- `POST /persons/provisional` — valid creation (alias prefixed with ~), duplicate alias (409)
- `PATCH /persons/:id` — promote provisional (isProvisional false, new alias), mark existing as provisional (alias gets ~ prefix)

### 12.2 Frontend Tests (Jest)

**EventFormModalComponent:**
- Renders in create mode (empty form, "Crear" button)
- Renders in edit mode (pre-filled form, "Desar" button)
- Validates required fields (title, type, date)
- Emits `saved` on success, `closed` on cancel

**AttendanceEditModalComponent:**
- Renders attendance data (person info, current status selected)
- "Desar" disabled when no changes
- "Desar" enabled after status change
- Shows warning for past events
- Delete confirmation flow
- Emits `saved` / `deleted` / `closed` correctly

**PersonSearchInputComponent:**
- Debounces input
- Shows results dropdown
- Excludes persons in `excludeIds`
- Emits `selected` on pick

**Services:**
- `EventService.create()` calls `POST /events`
- `EventService.updateFull()` calls `PUT /events/:id`
- `EventService.delete()` calls `DELETE /events/:id`
- `AttendanceService.create()` calls `POST /events/:id/attendance`
- `AttendanceService.update()` calls `PATCH /events/:id/attendance/:aId`
- `AttendanceService.delete()` calls `DELETE /events/:id/attendance/:aId`
- `PersonService.createProvisional()` calls `POST /persons/provisional`

---

## 13. Files Changed / Created Summary

### Backend (apps/api/)

| File | Action | Description |
|------|--------|-------------|
| `modules/event/dto/create-event.dto.ts` | 🆕 | CreateEventDto with validation |
| `modules/event/dto/update-event.dto.ts` | ✏️ | Expand to PartialType(CreateEventDto) |
| `modules/event/dto/create-attendance.dto.ts` | 🆕 | CreateAttendanceDto |
| `modules/event/dto/update-attendance.dto.ts` | 🆕 | UpdateAttendanceDto |
| `modules/event/event.controller.ts` | ✏️ | Add POST, PUT, DELETE endpoints |
| `modules/event/event.service.ts` | ✏️ | Add create(), expandUpdate(), remove() |
| `modules/event/attendance.service.ts` | ✏️ | Add create(), update(), remove() |
| `modules/person/person.entity.ts` | ✏️ | Add `isProvisional` column |
| `modules/person/person.controller.ts` | ✏️ | Add `POST /persons/provisional` |
| `modules/person/person.service.ts` | ✏️ | Add `createProvisional()`, handle promotion/demotion |
| `modules/person/dto/person-filter.dto.ts` | ✏️ | Add `isProvisional` filter |
| `modules/person/dto/create-person.dto.ts` | ✏️ | Validate alias doesn't start with `~` |
| `modules/event/event.controller.spec.ts` | ✏️ | Tests for new endpoints |
| `modules/event/attendance.service.spec.ts` | 🆕/✏️ | Tests for attendance CRUD |
| `modules/person/person.service.spec.ts` | ✏️ | Tests for provisional flow |

### Dashboard (apps/dashboard/)

| File | Action | Description |
|------|--------|-------------|
| `features/events/components/event-form-modal/*` | 🆕 | Event create/edit modal (3 files) |
| `features/events/components/attendance-edit-modal/*` | 🆕 | Attendance edit/delete modal (3 files) |
| `shared/components/forms/person-search-input/*` | 🆕 | Person autocomplete component (3 files) |
| `features/events/components/event-list/*` | ✏️ | Add "Nou event" button |
| `features/events/components/event-detail/*` | ✏️ | Integrate modals, remove inline edit, add delete, add attendance bar, add confirmed preset |
| `features/events/services/event.service.ts` | ✏️ | Add create, updateFull, delete |
| `features/events/services/attendance.service.ts` | ✏️ | Add create, update, delete |
| `features/events/models/event.model.ts` | ✏️ | Add CreateEventPayload, expand UpdateEventPayload |
| `features/events/models/attendance.model.ts` | ✏️ | Add CreateAttendancePayload, UpdateAttendancePayload, AttendanceResponse |
| `features/persons/components/person-list/*` | ✏️ | Add provisional filter + badge |
| `features/persons/services/person.service.ts` | ✏️ | Add createProvisional() |

### Shared (libs/shared/)

No changes required — all needed enums (`EventType`, `AttendanceStatus`, `AttendanceSummary`) already exist.

---

## 14. Implementation Order (Option A: Backend-first)

```
Phase 1 — Backend Event CRUD
  1. CreateEventDto + expand UpdateEventDto
  2. EventService: create(), expand update(), remove()
  3. EventController: POST, PUT, DELETE
  4. Tests

Phase 2 — Backend Attendance CRUD
  5. CreateAttendanceDto + UpdateAttendanceDto
  6. AttendanceService: create(), update(), remove() + summary return
  7. EventController: POST, PATCH, DELETE attendance routes
  8. Tests

Phase 3 — Backend Provisional Persons
  9. Person entity: add isProvisional column + migration
  10. PersonService: createProvisional(), promotion logic, retroactive marking
  11. PersonController: POST /persons/provisional
  12. PersonFilterDto: add isProvisional
  13. CreatePersonDto: validate alias no ~ prefix
  14. Tests

Phase 4 — Dashboard Event Form Modal
  15. EventFormModalComponent (create + edit)
  16. Dashboard EventService: create(), updateFull(), delete()
  17. EventListComponent: "Nou event" button
  18. EventDetailComponent: replace inline edit with modal, add delete
  19. Tests

Phase 5 — Dashboard Attendance Management
  20. AttendanceEditModalComponent (edit + delete)
  21. PersonSearchInputComponent (shared autocomplete)
  22. Dashboard AttendanceService: create(), update(), delete()
  23. Dashboard PersonService: createProvisional()
  24. EventDetailComponent: attendance bar, modals, optimistic updates, confirmed preset
  25. Tests

Phase 6 — Dashboard Person List Enhancements
  26. Person list: provisional filter + badge
  27. Person detail: provisional toggle action
```
