# PWA MuixerApp — Design Specification

> **Status:** Approved  
> **Date:** 2026-06-14  
> **Scope:** P6.0–P6.9 — Mobile PWA for colla members  
> **Audience:** Developers, spec reviewers, future contributors

---

## 1. Overview

Mobile-first Progressive Web App for members of a muixeranga colla. Primary use cases:
attendance confirmation (self + managed family members) and readonly figure (pinya) viewing.

**Target users:** ~40 active members, most non-technical, using Android/iOS mobile browsers.

**Key constraints:**
- 100% mobile-first (desktop is a bonus, not a target)
- Angular PWA (no Ionic, no native), port 4300 in dev
- Catalan UI, English code
- Reuse existing API auth infrastructure (JWT + httpOnly refresh cookie, 7-day TTL for PWA)
- Initially deployed on PRE server (IP-based), prepared for domain separation later

---

## 2. Architecture

### 2.1 App Structure

```
apps/pwa/src/app/
├── core/
│   ├── auth/
│   │   ├── services/auth.service.ts         # Signal-based auth state
│   │   ├── interceptors/auth.interceptor.ts  # Bearer + 401 refresh retry
│   │   ├── guards/auth.guard.ts
│   │   └── guards/roles.guard.ts
│   ├── services/
│   │   └── api.service.ts                    # Base HTTP client
│   └── layout/
│       └── app-shell/
│           ├── app-shell.component.ts        # Bottom tab bar + router-outlet
│           └── app-shell.component.html
│
├── features/
│   ├── auth/
│   │   ├── login/login.component.ts
│   │   └── magic-link/magic-link.component.ts
│   ├── home/
│   │   ├── home.component.ts
│   │   └── services/home.service.ts
│   ├── events/
│   │   ├── event-list/event-list.component.ts
│   │   ├── event-detail/event-detail.component.ts
│   │   ├── components/
│   │   │   ├── event-card/event-card.component.ts
│   │   │   ├── attendance-button/attendance-button.component.ts
│   │   │   ├── segment-accordion/segment-accordion.component.ts
│   │   │   └── person-selector/person-selector.component.ts
│   │   ├── services/event.service.ts
│   │   └── events.routes.ts
│   ├── pinyes/
│   │   ├── figure-viewer/figure-viewer.component.ts
│   │   ├── services/projection.service.ts
│   │   └── pinyes.routes.ts
│   └── profile/
│       ├── profile.component.ts
│       ├── services/profile.service.ts
│       └── profile.routes.ts
│
├── shared/
│   ├── components/
│   │   ├── bottom-tab-bar/bottom-tab-bar.component.ts
│   │   ├── mobile-header/mobile-header.component.ts
│   │   ├── empty-state/empty-state.component.ts
│   │   ├── loading-skeleton/loading-skeleton.component.ts
│   │   └── pull-to-refresh/pull-to-refresh.component.ts
│   ├── pipes/
│   │   └── relative-date.pipe.ts
│   └── utils/
│
├── app.component.ts
├── app.config.ts
├── app.routes.ts
└── environments/
    ├── environment.ts
    └── environment.pre.ts
```

### 2.2 Routing

```typescript
export const appRoutes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component'),
  },
  {
    path: 'auth/magic',
    loadComponent: () => import('./features/auth/magic-link/magic-link.component'),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'home', pathMatch: 'full' },
      {
        path: 'home',
        loadComponent: () => import('./features/home/home.component'),
      },
      {
        path: 'events',
        loadChildren: () => import('./features/events/events.routes'),
      },
      {
        path: 'profile',
        loadComponent: () => import('./features/profile/profile.component'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
```

Events sub-routes:

```typescript
export default [
  { path: '', component: EventListComponent },
  { path: ':id', component: EventDetailComponent },
  { path: ':eventId/segments/:segmentId/figures/:instanceId', component: FigureViewerComponent },
] as Routes;
```

### 2.3 Navigation — Bottom Tab Bar

Three tabs (P6.0–P6.6):

| Tab | Icon | Label | Route |
|-----|------|-------|-------|
| Inici | `home` | Inici | `/home` |
| Events | `calendar` | Events | `/events` |
| Perfil | `user` | Perfil | `/profile` |

Tab bar is hidden on fullscreen views (canvas, login).

---

## 3. Auth

### 3.1 Basic Auth (P6.1)

Adapted from Dashboard `AuthService` with these differences:

| Aspect | Dashboard | PWA |
|--------|-----------|-----|
| `clientType` | `DASHBOARD` | `PWA` |
| Refresh cookie TTL | 8 hours | 7 days |
| Roles accepted | TECHNICAL, ADMIN | MEMBER, TECHNICAL, ADMIN |
| Silent refresh on init | Yes | Yes |
| Login redirect | `/` (home tab) | `/home` |

**Login page:** email + password form. Minimal, mobile-optimized. Single "Entra" button. Link to "Has oblidat la contrasenya?" (initially shows "Contacta amb l'equip tècnic").

**Edge case — User without linked Person:** If `user.person` is null (account exists but no Person linked), the app shows an error state: "El teu compte no està vinculat a cap membre. Contacta amb l'equip tècnic." Attendance and canvas features are blocked. Auth flows (login, refresh, logout) still work.

**Auth flow:**
1. App loads → `AuthService.init()` → try silent refresh via `POST /auth/refresh`
2. Success → load user profile → navigate to Home
3. Fail → redirect to `/login`
4. Login form → `POST /auth/login { email, password, clientType: 'PWA' }`
5. Success → store access token in memory signal, refresh cookie set by backend
6. `authInterceptor` adds `Authorization: Bearer <token>`, `withCredentials: true`
7. On 401 → attempt refresh → success → retry original request / fail → redirect to login

### 3.2 Magic-Link Auth (P6.8)

**Purpose:** Allow admins to generate a shareable login link for non-technical members who may not remember passwords or check email.

#### Data Model

New entity `MagicLinkToken`:

```
magic_link_tokens
├── id              UUID PK
├── userId          FK → users.id (unique — one active token per user)
├── tokenHash       VARCHAR — bcrypt hash of the raw token
├── expiresAt       TIMESTAMP — createdAt + configurable TTL (default 72h)
├── consumedAt      TIMESTAMP (nullable) — set on first successful login
├── createdAt       TIMESTAMP
├── lastUsedAt      TIMESTAMP (nullable)
├── revokedAt       TIMESTAMP (nullable)
└── createdByUserId FK → users.id (the admin who generated it)
```

Unique constraint on `userId` (only one active token per user at a time).

**Token lifecycle:**
- **TTL**: 72 hours from creation (configurable via `MAGIC_LINK_TTL_HOURS` env var). After expiry, the link is dead. Admin can regenerate at any time.
- **Single-use**: On first successful login via magic-link, `consumedAt` is set. The token cannot be reused. This prevents link sharing, replay attacks, and accidental reuse from browser history.
- **Revocation**: Admin can revoke at any time (immediate effect, sets `revokedAt`).

#### Flow

1. **Generate (Dashboard):** Admin navigates to user management → clicks "Generar enllaç d'accés" → `POST /api/users/:id/magic-link`
2. **Backend:** Generates 32-byte random hex token → hashes with bcrypt → stores in `magic_link_tokens` (upsert: replaces any existing token for this user, sets `expiresAt = now + TTL`) → returns raw token in response
3. **Dashboard UI:** Shows copyable link: `https://<pwa-host>/auth/magic?token=<raw-token>` + expiry info ("Vàlid durant 72h"). Admin copies and shares via WhatsApp/Signal.
4. **Member clicks link:** PWA route `/auth/magic` extracts `token` from query params → `POST /api/auth/magic-link { token }`
5. **Backend validates (in order):**
   1. Iterates active tokens (non-revoked, non-expired, non-consumed) and bcrypt-compares
   2. If no match → 401
   3. Checks `revokedAt IS NULL` → if revoked → 401
   4. Checks `expiresAt > now` → if expired → 401
   5. Checks `consumedAt IS NULL` → if already consumed → 401
   6. Validates `user.isActive === true` → if inactive → 401
   7. Issues JWT + refresh cookie with `clientType: PWA` (7-day TTL)
   8. Sets `consumedAt = now` and `lastUsedAt = now` in a single transaction
6. **PWA:** Receives access token → stores in memory → redirects to `/home`
7. **Regenerate:** Admin can regenerate anytime → old token invalidated (deleted or marked revoked), new token issued with fresh TTL
8. **Revoke:** Admin can revoke without regenerating → `PATCH /api/users/:id/magic-link` with `{ revoked: true }`

**Error handling:** All validation failures return the same generic message: "L'enllaç no és vàlid o ha caducat. Contacta amb l'equip tècnic." (no information leakage about which specific check failed).

**Dashboard token status display:** The admin UI shows the token state as a badge:
- `actiu` (green) — valid, not expired, not consumed
- `caducat` (grey) — expiresAt has passed
- `consumit` (blue) — member used it successfully
- `revocat` (red) — admin revoked it

**Security notes:**
- Token has a **72-hour TTL** (configurable). After expiry, the link is dead — no indefinite exposure window.
- Token is **single-use**: consumed on first successful login. Prevents replay and accidental sharing via browser history or chat logs.
- Token can be **revoked** by admin at any time (immediate effect).
- Combined: worst-case exposure window is 72h IF the link hasn't been used yet. Once used, it's immediately dead.
- Token hash stored, never the raw token (bcrypt, VARCHAR(255))
- Rate limit magic-link validation endpoint (10 req/min per IP)
- Token is single-user: if shared publicly, only the intended user's session is at risk (mitigated by admin ability to revoke + automatic expiry)
- Regenerate/revoke does **not** invalidate existing active sessions (JWT + refresh). Admin can use "Tancar totes les sessions" (`POST /auth/logout-all`) separately if needed
- Token in URL query string: acceptable for trusted admin→WhatsApp channel at ~40 users. Exposure is time-bounded (72h max) and single-use
- Raw token returned in API response only to admin (TECHNICAL/ADMIN role); never logged
- Backend validates `user.isActive` on redeem — inactive accounts cannot use magic-links

### 3.3 Password Recovery (P6.8)

Admin-triggered: Dashboard → user management → "Restablir accés" → generates new magic-link (same as §3.2). Admin shares link with member via WhatsApp.

No email-based password reset in P6. Email recovery can be added as a future enhancement when email infrastructure is in place.

---

## 4. Family Management (P6.4)

### 4.1 Data Model

New entity `PersonGuardian`:

```
person_guardians
├── id                  UUID PK
├── guardianPersonId    FK → persons.id
├── managedPersonId     FK → persons.id
├── relationship        ENUM('PARE_MARE', 'TUTOR', 'PARELLA', 'ALTRE')
├── createdAt           TIMESTAMP
└── updatedAt           TIMESTAMP
```

Constraints:
- Unique on `(guardianPersonId, managedPersonId)` — no duplicate relationships
- `guardianPersonId != managedPersonId` — can't be own guardian
- No cascading: soft-deleting a Person does not remove guardian relations
- No cycles allowed (A→B and B→A)
- Guardian must be an active Person with a linked active User
- Inactive managed persons (`isActive: false`) excluded from `/me/managed-persons`

**Distinction from `Person.managedBy`:** The existing `Person.managedBy: User` field is an **account link** — it records which User account is associated with a Person record (set during user creation/invite). `PersonGuardian` is a **family relation** — it records which Person can manage attendance for another Person (parent→child, tutor→member). These serve different purposes and coexist:
- A parent (Person A, with User account) has `PersonGuardian` rows linking to their children (Person B, C)
- Children may or may not have their own User accounts
- `Person.managedBy` tracks the User↔Person 1:1 link, independent of guardian relations

New shared enum `GuardianRelationship`:

```typescript
export enum GuardianRelationship {
  PARE_MARE = 'PARE_MARE',
  TUTOR = 'TUTOR',
  PARELLA = 'PARELLA',
  ALTRE = 'ALTRE',
}
```

### 4.2 API

```
GET  /api/me/managed-persons              → PersonSummary[]
```

Attendance for managed persons uses the same attendance endpoint with a `personId` parameter:

```
PUT  /api/me/events/:eventId/attendance   → { personId?, status, notes? }
```

If `personId` is omitted → self-attendance (user's own linked Person).
If `personId` is provided → server validates it's a managed person of the current user.

### 4.3 Dashboard Integration

Dashboard user/person management gains:
- "Persones gestionades" section in person detail
- Add/remove guardian relationships
- Relationship type selector

### 4.4 PWA UX — Person Selector

When a user has managed persons, attendance components show a person selector:

```
┌─────────────────────────────┐
│  ◉ Jo (Maria Garcia)       │
│  ○ Pol Garcia (fill/a)      │
│  ○ Laia Garcia (fill/a)     │
└─────────────────────────────┘
```

- Default selection: self ("Jo")
- Switching person reloads attendance state for that person
- Attendance button reflects the selected person's status
- Person selector appears in: Home cards, Event list cards, Event detail

---

## 5. API Design — `/me/` Module

### 5.1 Architecture

New `MeModule` in `apps/api/src/modules/me/`:

```
me/
├── me.module.ts
├── me.controller.ts
├── me.service.ts
├── dto/
│   ├── me-event-filter.dto.ts
│   └── update-my-attendance.dto.ts
└── interfaces/
    └── me-responses.ts
```

`MeService` injects existing services (`EventService`, `AttendanceService`, `PersonService`, `EventSegmentService`) — no business logic duplication.

All endpoints require JWT authentication (any role: MEMBER, TECHNICAL, ADMIN). Role-based response enrichment handles the difference.

### 5.2 Endpoints

```
GET    /api/me/events
       Query: ?type=ASSAIG|ACTUACIO&season=current&timeFilter=upcoming|past|all&page=1&limit=20
       Defaults: season=current, timeFilter=upcoming, sorted by date ASC
       Response: { data: MeEvent[], meta: PaginatedMeta }
       If no current season exists: returns empty list (no error)

GET    /api/me/events/:id
       Response: MeEventDetail

PUT    /api/me/events/:id/attendance
       Body: { personId?: string, status: AttendanceStatus, notes?: string }
       Response: { status, respondedAt }
       Semantics: upsert — creates Attendance if none exists, updates if exists
       Constraints:
         - status ∈ {PENDENT, ANIRE, NO_VAIG} (ASSISTIT/NO_PRESENTAT reserved for check-in)
         - personId must be own Person or a managed Person (403 otherwise)
         - Event must not be in the past (400: "L'event ja ha passat")
         - Event must exist and belong to current season (404)

GET    /api/me/managed-persons
       Response: PersonSummary[]

GET    /api/me/profile/stats
       Response: { attendanceRate, eventsAttended, eventsTotal, ... }
```

### 5.3 Response Types

```typescript
interface MeEvent {
  id: string;
  eventType: EventType;
  title: string;
  date: string;           // ISO date
  startTime: string;      // HH:mm
  location: string;
  locationUrl?: string;
  myAttendance: {
    status: AttendanceStatus;
    respondedAt?: string;
    notes?: string;
  } | null;
  managedPersonsAttendance: ManagedAttendance[];  // empty [] until P6.4 (family management)
  // TECHNICAL/ADMIN enrichment:
  attendanceSummary?: AttendanceSummary;
}

interface ManagedAttendance {
  person: PersonSummary;
  status: AttendanceStatus;
  respondedAt?: string;
}

interface MeEventDetail extends MeEvent {
  description?: string;
  information?: string;
  segments: MeSegment[];   // filtered: only isVisible=true for MEMBER
  // TECHNICAL/ADMIN enrichment:
  attendees?: AttendeeItem[];
}

interface MeSegment {
  id: string;
  order: number;
  label?: string;
  figures: MeSegmentFigure[];
}

interface MeSegmentFigure {
  instanceId: string;
  templateName: string;
  myAssignment?: {
    nodeId: string;
    nodeLabel: string;
    zone: FigureZone;
  } | null;
}

interface AttendeeItem {
  person: PersonSummary;
  status: AttendanceStatus;
  respondedAt?: string;
}
```

### 5.4 Projection Endpoint — Role Relaxation

Existing endpoint `GET /api/events/:eventId/segments/:segmentId/projection` gets MEMBER role added:

```typescript
@Roles(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN)
```

With server-side guard: if role is MEMBER, the segment must have `isVisible: true`. Returns 403 otherwise.

---

## 6. Pages — Detailed Functionality

### 6.1 Login (`/login`)

- Email + password form (mobile-optimized, large tap targets)
- "Entra" primary button
- "Has oblidat la contrasenya? Contacta amb l'equip tècnic" helper text
- Error messages in Catalan: "Correu o contrasenya incorrectes"
- On success → redirect to `/home`
- Auto-redirect to `/home` if already authenticated

### 6.2 Magic-Link Landing (`/auth/magic`)

- Extracts `token` from query params
- Shows loading spinner: "Entrant..."
- Validates via `POST /api/auth/magic-link`
- Success → redirect to `/home`
- Error → "L'enllaç no és vàlid o ha caducat. Contacta amb l'equip tècnic." (covers: expired, consumed, revoked, invalid)

### 6.3 Home (`/home`)

Top-to-bottom layout:

1. **Header:** "Hola, {firstName}" + avatar placeholder
2. **Alert banner** (future — P7): last important notice. Hidden if none.
3. **Next rehearsal card:**
   - Title: formatted date ("Dilluns 16 de juny")
   - Subtitle: "Assaig"
   - Location with map link icon
   - Start time
   - Attendance button (Vinc / No vinc / Pendent)
   - If has managed persons: person selector inline
4. **Next performance card:**
   - Title: event title (e.g., "Festa Major de Gràcia")
   - Subtitle: formatted date
   - Location with map link icon
   - Attendance button
   - If has managed persons: person selector inline
5. **Empty state:** "No hi ha events programats" if no upcoming events

Cards are tappable → navigate to event detail.

### 6.4 Events List (`/events`)

- **Filter tabs** at top: "Tots" | "Assajos" | "Actuacions" (horizontal scroll, pill buttons)
- **Card list** sorted by date ascending (upcoming first):
  - **Assaig cards:**
    - Title: formatted date ("Dilluns 16 de juny")
    - Subtitle: "Assaig"
    - Location
    - Left accent border: secondary color
  - **Actuació cards:**
    - Title: event title
    - Subtitle: formatted date
    - Location
    - Left accent border: primary color
  - Both card types show:
    - Attendance button (compact: icon + status text)
    - Person selector if has managed persons
    - TECHNICAL: attendance summary badge (e.g., "12/15 confirmats")
- **Pull-to-refresh** to reload events
- Cards are tappable → navigate to event detail
- Default: current season events, sorted by date

### 6.5 Event Detail (`/events/:id`)

Top-to-bottom layout:

1. **Header:** back arrow + event title (or date for assaig)
2. **Info section:**
   - Date + time
   - Location (tappable → opens maps)
   - Description (if any)
   - Additional info (if any)
3. **Attendance section:**
   - Person selector (if managed persons)
   - Large attendance button: "Vinc" / "No vinc" / "Pendent"
   - Status indicator with respondedAt timestamp
4. **TECHNICAL: Attendees section:**
   - Confirmed count badge
   - Expandable list of confirmed/declined/pending members
5. **Segments accordion** (only for events with visible segments):
   - Each segment expands to show:
     - Segment label (or "Segment 1", "Segment 2"...)
     - Figure cards:
       - Figure template name
       - "Ets a aquesta pinya" badge if member is assigned
       - Position/zone info if assigned (e.g., "Pinya · Cordó 2")
       - Tap → navigate to figure canvas

### 6.6 Figure Viewer (`/events/:eventId/segments/:segmentId/figures/:instanceId`)

Fullscreen view (tab bar hidden):

- **Top bar:** back arrow + figure template name
- **Konva canvas** (readonly mode):
  - Pinya view with all nodes
  - Touch: pinch-to-zoom, pan/drag
  - Auto-fit to viewport width on load
  - **Own position highlight:** pulsing ring animation (Konva Tween) + primary color fill on user's assigned node
  - **Missing persons (assaig only):** orange border (`#f97316`, strokeWidth 3) on nodes where person status ≠ ASSISTIT
  - Node labels visible (person aliases)
- **Tronc toggle button** (if figure has tronc): switch to tronc view
- **Segment navigation:** swipe left/right or arrows to navigate between figures within the segment

### 6.7 Profile (`/profile`)

Top-to-bottom layout:

1. **User info:** name, email, avatar placeholder
2. **Stats section** (P6.6):
   - Attendance rate (%)
   - Events attended this season
   - Total events this season
3. **Settings:**
   - Notification preferences (toggle switches, prep for P6.9)
   - Language (fixed: Català, shown for future multi-lang)
4. **Actions:**
   - "Canviar contrasenya" (P6.8 — requires `PATCH /auth/change-password` endpoint; until then shows "Contacta amb l'equip tècnic per canviar la contrasenya")
   - "Tancar sessió" (logout → clear tokens → redirect to login)
5. **App info:** version number, "Fet amb ❤️ per la comissió digital"

---

## 7. UI/UX Design Principles

### 7.1 Visual Language

- **Framework:** DaisyUI v4 + Tailwind v3 (same as Dashboard)
- **Theme:** `colla-barcelona` (shared `tailwind.config.js` already includes PWA paths)
- **Font:** Inter (Google Fonts)
- **Icons:** Lucide Angular
- **Language:** `lang="ca"` on `<html>`
- **Data theme:** `data-theme="colla-barcelona"` on root

### 7.2 Mobile Patterns

- Minimum tap target: 44×44px (WCAG)
- Bottom tab bar: 56px height, fixed position, 3 tabs
- Cards: full-width, rounded corners, subtle shadow
- Pull-to-refresh on list views
- Skeleton loaders during data fetch
- Toast notifications for attendance changes
- No horizontal scrolling (except filter tabs)
- Content padded 16px sides

### 7.3 Accessibility (UNE-EN 301 549 / WCAG 2.1 AA)

- Semantic HTML: `<nav>`, `<main>`, `<header>`, `<button>`
- All interactive elements keyboard-focusable with visible focus indicator
- Color contrast ≥ 4.5:1 for text, ≥ 3:1 for UI components
- Attendance status conveyed by text + color (never color alone)
- Canvas: `aria-label` on Konva container with figure description
- Loading states announced via `aria-live="polite"`

### 7.4 Event Card Differentiation

| Attribute | Assaig | Actuació |
|-----------|--------|----------|
| Title | Formatted date ("Dilluns 16 de juny") | Event title |
| Subtitle | "Assaig" | Formatted date |
| Accent | Secondary color left border | Primary color left border |
| Default sort | Chronological ascending | Chronological ascending |

---

## 8. Canvas — Mobile Readonly (P6.5)

### 8.1 Technology

Konva (already a root dependency) in `readonly` mode. Reuse rendering logic from Dashboard's `FigureCanvasComponent` where possible, adapted for mobile touch.

### 8.2 Touch Interactions

- **Pan:** single-finger drag on the stage (`Konva.Stage.draggable(true)`)
- **Zoom:** pinch gesture via Konva's native touch events or Hammer.js
- **Zoom range:** 0.3x — 3.0x
- **Initial state:** auto-fit figure to viewport width with 16px padding
- **Double-tap:** zoom to 2x centered on tap point (or reset if already zoomed)

### 8.3 Visual Highlights

**Own position (all events):**
- Primary color fill on the user's assigned node
- Pulsing ring animation: `Konva.Tween` on a circle behind the node, cycling opacity 0.3–0.8 over 1.5s
- Ensure visible regardless of zoom level (minimum visual size)

**Missing persons (assaig only):**
- Orange border (`#f97316`, strokeWidth 3) on nodes where assigned person has `attendanceStatus !== 'ANIRE'` (not confirmed)
- Data source: projection endpoint enriched with `attendanceStatus` per assignment, or a secondary fetch to `/me/events/:id` for attendance data. Implementation decided at P6.5.
- Only shown for events of type `ASSAIG`
- For `ACTUACIO`: not applicable (no check-in concept yet)

### 8.4 Navigation

- **Between figures:** swipe left/right or arrow buttons at bottom
- **Segment selector:** dropdown or pill bar at top showing current segment
- **Tronc toggle:** floating button to switch between pinya and tronc views

---

## 9. Deployment

### 9.1 Development

| App | Port | API Proxy |
|-----|------|-----------|
| Dashboard | 4200 | `proxy.conf.json → localhost:3000` |
| **PWA** | **4300** | `proxy.conf.json → localhost:3000` |
| API | 3000 | — |

PWA `project.json` needs:
- `serve` target: `port: 4300`
- `proxyConfig: apps/pwa/proxy.conf.json`

### 9.2 PRE Environment (IP-based)

Initial deployment on existing PRE server alongside Dashboard:

```
# Caddy or nginx route configuration
# All on the same IP, path-based routing

/api/*              → api container :3000
/dashboard/*        → dashboard static files
/app/*              → pwa static files

# OR port-based if simpler for initial testing
:3000               → api
:4200               → dashboard
:4300               → pwa
```

**Docker Compose addition** (`docker-compose.pre.yml`):

```yaml
pwa:
  build:
    context: .
    dockerfile: apps/pwa/Dockerfile
  restart: unless-stopped
```

PWA Dockerfile follows same multi-stage pattern as Dashboard (build → nginx/caddy static serve).

### 9.3 Future (Domain-based)

```
dashboard.muixeranga.cat → dashboard container
app.muixeranga.cat       → pwa container
api.muixeranga.cat       → api container
```

Switching is a `.env` change (`API_URL`, `CORS_ORIGINS`, `COOKIE_DOMAIN`). No code changes needed.

### 9.4 CORS

`.env` already includes PWA origin placeholder. Update for PRE:

```
CORS_ORIGINS=http://localhost:4200,http://localhost:4300,http://<PRE_IP>:4200,http://<PRE_IP>:4300
```

---

## 10. Testing Strategy

| Layer | Tool | Scope |
|-------|------|-------|
| Backend unit | Jest | `MeController`, `MeService`, `PersonGuardianService`, `MagicLinkService` |
| Backend integration | Supertest | Auth flow + attendance as MEMBER, managed persons |
| Frontend unit | Vitest | Components (event-card, attendance-button, person-selector), services, guards, pipes |
| Frontend e2e | Playwright | Login → events → attendance → event detail → canvas |
| Manual mobile | Real device | Touch gestures, responsiveness, PWA install prompt |

### 10.1 Key Test Scenarios

**Auth:**
- Login with valid/invalid credentials
- Silent refresh on app load
- Magic-link login (valid token, expired token, consumed token, revoked token, invalid token)
- Magic-link single-use: second attempt with same token fails after first login
- Redirect to login on expired session

**Attendance:**
- Confirm/decline attendance for self
- Confirm/decline attendance for managed person
- Validate personId belongs to current user's managed persons
- Prevent ASSISTIT/NO_PRESENTAT status (reserved for check-in)

**Family Management:**
- List managed persons
- Guardian cannot manage non-assigned persons
- Self is always available (no guardian relation needed)

**Canvas:**
- Load projection data for visible segment
- MEMBER cannot access non-visible segment (403)
- Own position highlighted
- Touch zoom/pan functional

---

## 11. Error Handling

### 11.1 Network Errors

PWA-specific error interceptor:
- Network failure → toast: "Sense connexió a Internet"
- 5xx → toast: "Error del servidor. Torna-ho a provar."
- 403 → toast: "No tens permisos per accedir a aquest recurs"
- 404 → navigate to empty state or back

### 11.2 Attendance Conflicts

- Event locked (past event) → attendance button disabled + text: "L'event ja ha passat"
- Optimistic UI: update attendance locally → revert on API error with toast

### 11.3 Auth Expiry

- Silent refresh fails → redirect to `/login` with message: "La sessió ha expirat. Torna a entrar."

---

## 12. Phase Breakdown

See [PWA_ROADMAP.md](PWA_ROADMAP.md) for the detailed 10-phase plan (P6.0–P6.9).

---

## 13. Shared Library Additions

New exports in `@muixer/shared`:

```typescript
// Enum
export enum GuardianRelationship {
  PARE_MARE = 'PARE_MARE',
  TUTOR = 'TUTOR',
  PARELLA = 'PARELLA',
  ALTRE = 'ALTRE',
}

// Interfaces (in pinyes/ or new me/ folder)
export interface MeEvent { ... }
export interface MeEventDetail { ... }
export interface MeSegment { ... }
export interface MeSegmentFigure { ... }
export interface ManagedAttendance { ... }
```

---

## 14. Out of Scope (Deferred)

| Feature | Deferred to | Reason |
|---------|-------------|--------|
| Check-in / "entrada" | Future (cross-cutting: API + Dashboard + PWA) |  Requires dashboard development too |
| Push notifications | P6.9 | Requires FCM setup, device management |
| Offline mode / service worker caching | Post-P6 | Online-only for MVP simplicity. P6.9 adds SW for push notifications only, not offline cache |
| Calendar view | P7+ | Not critical for attendance flow |
| News / notices | P7+ | Requires backend content management |
| Payment / activities | P7+ | Requires payment gateway integration |
| Email-based password recovery | P7+ | Members may not check email |
| PWA install prompt | P6.0 (basic manifest only) | Full install UX later |

---

## 15. References

| Document | Path |
|----------|------|
| Project Roadmap | [PROJECT_ROADMAP.md](../PROJECT_ROADMAP.md) |
| PWA Roadmap | [PWA_ROADMAP.md](PWA_ROADMAP.md) |
| Auth Flow | [AUTH_FLOW.md](../AUTH_FLOW.md) |
| Data Model | [DATA_MODEL.md](../DATA_MODEL.md) |
| Pinyes Module | [PINYES_MODULE.md](../PINYES_MODULE.md) |
| Dashboard UI | [DASHBOARD_UI.md](../DASHBOARD_UI.md) |
