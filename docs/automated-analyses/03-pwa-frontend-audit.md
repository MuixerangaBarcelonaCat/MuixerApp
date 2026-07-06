# Recommendation: distinguish "both calls failed" from "no upcoming events" (e.g. catchError → a sentinel, or let forkJoin fail and show an error state with retry).MuixerApp — PWA Frontend Analysis

> Full audit of `apps/pwa` (member-facing Angular PWA, P6 — work in progress, only basic features implemented). Every source file was read; the test suite was executed, not just read. API contract claims were verified against the actual NestJS controllers/DTOs in `apps/api`, and UI text was checked against the project language rules (`.agents/skills/language-rules`). Date: 2026-07-07 · Branch: `feat/pwa-app-start` · Severity: 🔴 High · 🟠 Medium · 🟡 Low · 🔵 Suggestion
>
> Because the app is explicitly unfinished, "feature not built yet" is only reported when the current code *pretends* the feature exists, or when the gap breaks something that already shipped.

## Index

1. [Executive summary](#0-executive-summary)
2. [Bugs & correctness](#1-bugs--correctness) — `PWA-BUG-N`
3. [Architecture & state management](#2-architecture--state-management) — `PWA-ARCH-N` (includes dead code & abandoned refactors as a subcategory)
4. [Error handling & network robustness](#3-error-handling--network-robustness) — `PWA-ERR-N`
5. [UX & interface consistency](#4-ux--interface-consistency) — `PWA-UX-N`
6. [Accessibility](#5-accessibility) — `PWA-A11Y-N`
7. [Performance](#6-performance) — `PWA-PERF-N`
8. [API contract drift](#7-api-contract-drift) — `PWA-API-N`
9. [Code smells & conventions](#8-code-smells--conventions) — `PWA-SM-N`
10. [UI text / language](#9-ui-text--language) — `PWA-LANG-N`
11. [Tests](#10-tests) — `PWA-TEST-N`

---

## 0. Executive summary

For a work-in-progress app, the foundation is solid: standalone components with signals + `OnPush` throughout, new control flow, typed reactive forms, access token kept in memory with silent refresh + request retry, optimistic attendance updates with rollback, lazy routes, and a real, green test suite (103 tests) with visible accessibility *effort* (aria-labels everywhere, live regions, semantic attempts). No `innerHTML`, no `localStorage` tokens, no XSS-shaped holes were found. Zero 🔴 findings — nothing here destroys data or breaks auth outright.

The findings cluster around four themes:

1. **Wiring gaps in shipped features** — logout exists in the service but no UI calls it, and the interceptor guarantees it couldn't revoke the session anyway (PWA-BUG-1/2); the `attendanceChanged` output is bound in 1 of 4 render sites, so the calendar shows stale dots (PWA-BUG-4); the `ASSISTIT` status renders as "Pendent" (PWA-BUG-3).
2. **Failures rendered as data** — an unreachable API produces "there are no upcoming events" on home (PWA-ERR-1), a silent empty calendar (PWA-ERR-4), and "wrong credentials" for a throttled login (PWA-ERR-2). Two specs *assert* these behaviors as correct (PWA-TEST-2).
3. **The "P" of PWA is missing** — no service worker, an unused render-blocking Google Fonts dependency, no cache headers, no offline handling (PWA-ARCH-1, PWA-PERF-1/2, PWA-ERR-6).
4. **Guardrails switched off** — CI excludes the PWA from both test and build (PWA-TEST-1), and the UI copy systematically diverges from the mandated Valencian style guide (§9).

**Findings by section:**


| Section                            | 🔴    | 🟠     | 🟡     | 🔵     | Total  |
| ---------------------------------- | ----- | ------ | ------ | ------ | ------ |
| 1. Bugs & correctness              | —     | 4      | 5      | —      | 9      |
| 2. Architecture & state management | —     | 1      | 5      | 1      | 7      |
| 3. Error handling & robustness     | —     | 2      | 4      | 1      | 7      |
| 4. UX & interface consistency      | —     | 2      | 5      | 3      | 10     |
| 5. Accessibility                   | —     | —      | 4      | 2      | 6      |
| 6. Performance                     | —     | —      | 3      | 1      | 4      |
| 7. API contract drift              | —     | 2      | 2      | 1      | 5      |
| 8. Code smells & conventions       | —     | —      | 4      | 3      | 7      |
| 9. UI text / language              | —     | 1      | 4      | 1      | 6      |
| 10. Tests                          | —     | 1      | 2      | 1      | 4      |
| **Total**                          | **0** | **13** | **38** | **14** | **65** |


**Fix first — ranked across every section:**


| #   | Finding                                                                                                                                                                                                                                                                         | Where                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1   | 🟠 [PWA-BUG-2](#-fe-bug-2--logout-can-never-revoke-the-server-session-missing-bearer-on-auth-requests) + [PWA-BUG-1](#-fe-bug-1--there-is-no-way-to-log-out) Fix the interceptor's `/auth/` token skip, then add the logout button — 7-day sessions on shared phones until then | `auth.interceptor.ts:13`, `profile.component.ts` |
| 2   | 🟠 [PWA-TEST-1](#-fe-test-1--the-pwa-is-excluded-from-ci-tests-and-build-never-run) Re-include `pwa` in CI test + build — every other fix is unguarded until this lands                                                                                                         | `.github/workflows/ci.yml:75-92`                 |
| 3   | 🟠 [PWA-ERR-1](#-fe-err-1--home-converts-every-failure-into-there-are-no-events) Home shows "no events" when the API is down                                                                                                                                                    | `home.service.ts:20,27`                          |
| 4   | 🟠 [PWA-UX-2](#-fe-ux-2--attendance-button-is-offered-where-it-can-only-fail) / [PWA-API-2](#-fe-api-2--server-forbids-past-event-attendance-client-ui-doesnt-know) Attendance offered on past events / unlinked accounts — always fails                                        | `attendance-button`, cards, detail               |
| 5   | 🟠 [PWA-BUG-3](#-fe-bug-3--attendancestatusassistit-is-unhandled-displayed-as-pendent-and-cycled-into-anire) `ASSISTIT` shown as "Pendent", tap rewrites it to `ANIRE`                                                                                                          | `attendance-button.component.ts:17-27`           |
| 6   | 🟠 [PWA-BUG-4](#-fe-bug-4--attendance-changes-dont-propagate-across-views-stale-calendar-cache) Attendance changes don't reach the calendar cache                                                                                                                               | `event-list.component.html:47`, `home`, detail   |
| 7   | 🟠 [PWA-ERR-2](#-fe-err-2--login-reports-every-failure-as-wrong-credentials) Login says "wrong credentials" for network/429/5xx failures                                                                                                                                        | `login.component.ts:40-43`                       |
| 8   | 🟠 [PWA-BUG-6](#-fe-bug-6--silent-truncation-list-capped-at-50-calendar-at-100-events-meta-is-never-read) / [PWA-API-1](#-fe-api-1--paginatedresponsemeta-is-dead-weight-to-the-pwa-server-caps-make-full-data-unreachable) Season data silently truncated at 50/100 events     | `event-list.component.ts:169,176`                |
| 9   | 🟠 [PWA-ARCH-1](#-fe-arch-1--pwa-without-a-service-worker-no-offline-no-caching-no-update-flow) Add the service worker — installable-but-offline-dead today                                                                                                                     | `app.config.ts`, `package.json`                  |
| 10  | 🟠 [PWA-LANG-1](#-fe-lang-1--events-anglicism-across-the-whole-app) "Events" anglicism + «tu» treatment sweep, before more copy accumulates                                                                                                                                     | 9+ strings across templates                      |


The cheapest high-leverage cleanup: delete the three Google Fonts lines in `index.html` (PWA-PERF-1 — the font isn't even used) and type the status maps as `Record<AttendanceStatus, …>` (PWA-SM-3 — turns the PWA-BUG-3 class of bug into compile errors).

---

## 1. Bugs & correctness

### 🟠 PWA-BUG-1 — There is no way to log out

`AuthService.logout()` (`apps/pwa/src/app/core/auth/services/auth.service.ts:88`) is never called from any component — a repo-wide grep finds zero UI usages. `ProfileComponent` is a stub ("Pròximament: perfil del membre") and no other screen offers a logout action.

Combined with the PWA refresh-token TTL of **7 days** (`JWT_REFRESH_TTL_PWA = 604800` in `apps/api/src/modules/auth/constants/auth.constants.ts:3`) and silent refresh on every app start, a session on a shared or borrowed phone stays alive indefinitely (each open rotates the cookie for another 7 days). The only escape is clearing site data manually.

**Recommendation:** add a logout button to the profile screen (even while the rest of profile is unimplemented) that calls `logout()`, then navigates to `/login`.

### 🟠 PWA-BUG-2 — `logout()` can never revoke the server session (missing Bearer on `/auth/` requests)

Two facts collide:

1. The interceptor short-circuits every `/auth/` URL **without attaching the `Authorization` header** — `apps/pwa/src/app/core/auth/interceptors/auth.interceptor.ts:13-15`.
2. `POST /api/auth/logout` is **not** `@Public()` — it sits behind the global `JwtAuthGuard` and documents `401 Token d'accés invàlid` (`apps/api/src/modules/auth/auth.controller.ts:103-116`).

So when logout is eventually wired to the UI, the request will always be rejected with 401. `logout()`'s `catchError` (`auth.service.ts:93-96`) then swallows the failure and clears local state, so it *looks* logged out — but the refresh token is never revoked and the httpOnly cookie is never cleared by the server. Reopening the app silently logs the user back in via `silentRefresh()`.

**Recommendation:** in the interceptor, only skip the token for the public auth endpoints (`/auth/login`, `/auth/refresh`), or attach the token whenever one exists. Verify with a manual logout → app reopen: it must land on `/login`.

### 🟠 PWA-BUG-3 — `AttendanceStatus.ASSISTIT` is unhandled: displayed as "Pendent" and cycled into `ANIRE`

The shared enum has four statuses (`libs/shared/src/enums/attendance-status.enum.ts:12` — `ASSISTIT` = attended, set during/after the event through other channels), and `GET /me/events` happily returns it. The PWA only maps three:

- `STATUS_CONFIG` / `STATUS_CYCLE` (`attendance-button.component.ts:17-27`) have no `ASSISTIT` entry → the button renders the `?? 'Pendent'` / `?? 'btn-warning'` fallbacks (`:69-73`). A member who **attended** an event sees "Pendent" in amber.
- `getNextStatus(ASSISTIT)` → `indexOf` returns `-1` → `(-1 + 1) % 3 = 0` → tapping sends `ANIRE` (`:111-114`), overwriting a confirmed-attended record for a same-day event (past events are rejected server-side, see PWA-API-2, but *today's* event is mutable).
- The calendar has no `ASSISTIT_`* key in `DOT_CLASSES` (`calendar-view.component.ts:63-72`) → falls back to a generic grey outline dot, and `dayAriaLabel` announces "Pendent" (`:176`).

**Recommendation:** type the maps as `Record<AttendanceStatus, …>` so the compiler forces exhaustiveness (see PWA-SM-3), render `ASSISTIT` as a distinct read-only state ("Assistit"), and exclude it from the tap cycle.

### 🟠 PWA-BUG-4 — Attendance changes don't propagate across views (stale calendar cache)

`EventCardComponent` emits `attendanceChanged`, but the output is only bound in **one** of four render sites:

- List mode: `<app-event-card [event]="event" />` — no binding (`event-list.component.html:47-49`).
- Home next-rehearsal / next-performance cards — no binding (`home.component.html:37,46`).
- Event detail's attendance button — no `statusChanged` binding at all (`event-detail.component.html:72-78`).
- Calendar selected-day cards — bound correctly (`event-list.component.html:76-79`).

The button itself is optimistic and self-contained, so the tapped card looks right. But `EventListComponent.allSeasonEvents` is loaded once and then guarded by `calendarDataLoaded` forever (`event-list.component.ts:123-126, 182`). Change attendance from the list (or detail, or home), switch to calendar view → the dot still shows the old status until a manual pull-to-refresh. `onAttendanceChanged` exists precisely to patch both signals (`:147-164`) — it just never fires from three of the four sites.

**Recommendation:** bind `(attendanceChanged)` on every `app-event-card` and propagate `statusChanged` from the detail page, or better: move attendance state into a small shared store (see PWA-ARCH-3).

### 🟡 PWA-BUG-5 — Event detail never reloads when the `:id` input changes

`EventDetailComponent` fetches once in `ngOnInit` (`event-detail.component.ts:51-64`) using `input.required<string>() id`. With `withComponentInputBinding()`, navigating from `/events/A` to `/events/B` reuses the component instance and updates the input — but nothing refetches, so the old event stays on screen. No such navigation exists *today* (the only path is list → detail → back), but the first "related events" or notification deep-link feature will hit it silently.

**Recommendation:** react to the input, e.g. convert the fetch into an `rxResource`/`effect` keyed on `this.id()`, or `toObservable(this.id).pipe(switchMap(...))`.

### 🟡 PWA-BUG-6 — Silent truncation: list capped at 50, calendar at 100 events; `meta` is never read

- List: `loadEvents()` requests `limit: 50` (`event-list.component.ts:166-171`). The "Tots" and "Passats" filters over a full season (2 rehearsals/week + performances ≈ 100–150 events) will silently drop everything past 50 — no pagination, no "load more", `meta.total` ignored.
- Calendar: `loadAllSeasonEvents()` requests `limit: 100` (`:176`), which is also the server's hard ceiling (`@Max(100)`, `apps/api/src/modules/me/dto/me-event-filter.dto.ts:26`) — so a >100-event season **cannot** be fully fetched in one call. Months late in the season simply show no dots.

**Recommendation:** at minimum compare `meta.total` with `data.length` and fetch remaining pages for the calendar; for the list, add pagination or infinite scroll. Cross-ref PWA-API-1.

### 🟡 PWA-BUG-7 — Authenticated user with a disallowed role would enter a redirect loop

`rolesGuard` redirects failures to `/login` (`roles.guard.ts:15`), but `/login` is guarded by `alreadyAuthGuard`, which bounces authenticated users to `/home` (`already-auth.guard.ts:11`), which fails the roles guard again → infinite navigation loop. Today it's latent-only because the shell route whitelists **all three existing roles** (`app.routes.ts:24` — which also makes the guard a no-op, see PWA-SM-2); the first new `UserRole` enum value turns it live.

**Recommendation:** redirect role failures to a dedicated "no access" page, or have `rolesGuard` trigger a logout instead of a bare `/login` redirect.

### 🟡 PWA-BUG-8 — Gesture conflicts: swipe and pull handlers ignore the cross axis

- `CalendarViewComponent` changes month whenever `|dx| ≥ 50` on `touchend` (`calendar-view.component.ts:117-125`) with **no dy comparison** — a diagonal scroll gesture over the calendar flips the month.
- `PullToRefreshComponent` triggers refresh whenever `dy ≥ 60` (`pull-to-refresh.component.ts:89-102`) with **no dx comparison** — and in the events screen the calendar is nested *inside* the pull-to-refresh, so a horizontal month swipe that drifts 60px downward both changes month **and** fires a refresh (which also resets the month's selected date via `onRefresh`).

**Recommendation:** in both handlers require axis dominance (`Math.abs(dx) > Math.abs(dy)` for swipe, inverse for pull) before acting.

### 🟡 PWA-BUG-9 — Back button is dead on deep links / fresh PWA launches

`MobileHeaderComponent.goBack()` calls `Location.back()` (`mobile-header.component.ts:37-39`). When `/events/:id` is the first document of the session (shared link, installed-app cold start on that URL, browser restore), there is no history entry — the button does nothing, or in an installed PWA closes the app. The event detail page is exactly the screen people will share.

**Recommendation:** fall back when there's no meaningful history, e.g. inject `Router` and navigate to a `fallbackUrl` input (`/events`) when `history.length <= 1` or via `Navigation.previousNavigation === null`.

---

## 2. Architecture & state management

### 🟠 PWA-ARCH-1 — "PWA" without a service worker: no offline, no caching, no update flow

`@angular/service-worker` is not in `package.json`, there is no `ngsw-config.json`, and `app.config.ts` has no `provideServiceWorker`. What exists is a manifest (`public/manifest.webmanifest`) → the app is *installable*, but an installed "app" that white-screens without network (all JS comes from the network, fonts from a CDN — PWA-PERF-1). Members will open this on phones in the street before actuacions; flaky connectivity is the primary environment. This is the single biggest architectural gap for P6, and it also blocks any future push-notification story.

**Recommendation:** add `provideServiceWorker('ngsw-worker.js', ...)` + `ngsw-config.json` early (app shell + icon/font caching now; runtime caching for `/api/me/events` later). It also gives update management (`SwUpdate`) which the Caddy no-cache-headers issue makes relevant (PWA-PERF-3).

### 🟡 PWA-ARCH-2 — Auth contract types re-declared instead of imported from `@muixer/shared`

`UserProfile` and `PersonSummary` are defined **three times**: in `libs/shared/src/interfaces/auth.interfaces.ts:11-26`, in `apps/dashboard/.../core/auth/models/auth.models.ts`, and again in `apps/pwa/src/app/core/auth/models/auth.models.ts:9-23`. The PWA copy already exists solely to be kept in sync by hand; any backend change to the login payload now needs three edits, and TypeScript will not flag drift because the copies are structurally checked only where used. (`LoginRequest`/`AuthResponse` exist nowhere in the shared lib — they'd be worth promoting while at it.)

**Recommendation:** delete the PWA (and dashboard) copies, import from `@muixer/shared`, and add `AuthResponse`/`LoginRequest` to the shared lib next to `JwtPayload`.

### 🟡 PWA-ARCH-3 — Attendance mutation lives in a leaf presentational component; state is split across four owners

`AttendanceButtonComponent` injects `EventService` and `ToastService` and performs the PUT itself (`attendance-button.component.ts:95-108`), while each parent keeps its own copy of the event list (`events`, `allSeasonEvents` in the list; `nextRehearsal`/`nextPerformance` in home; `event` in detail). Synchronization is attempted via the `statusChanged` output — and three of four sites forget to wire it (PWA-BUG-4). This is the classic "smart leaf" shape: the more places the card is embedded, the more copies drift.

**Recommendation:** either make the button dumb (emit intent, let the container mutate) or introduce a tiny signal store (à la dashboard's `AssignmentStateService`) that owns `MeEvent[]` + attendance patches, which every view reads.

### 🟡 PWA-ARCH-4 — `effect()` used to mirror an input into a writable signal

`attendance-button.component.ts:80-84` syncs `status` → `localStatus` with an `effect`. This is exactly the pattern `linkedSignal` replaces (local value that resets when the source changes); the effect version runs after change detection, allows a frame of stale UI, and needs `allowSignalWrites` semantics that Angular has been discouraging.

**Recommendation:** `private readonly localStatus = linkedSignal(() => this.status());`

### 🟡 PWA-ARCH-5 — Per-screen ad-hoc fetch/error/loading scaffolding

Every screen hand-rolls the same trio (`isLoading` / `hasError` / data signal) with different behaviors: list uses a `Subject` + `switchMap` (cancels correctly), home and calendar use raw nested `subscribe` (no cancellation — two overlapping pull-to-refreshes race, last write wins by luck), detail fetches once. None share a helper. As screens grow (segments, pinya view are next per P6), this multiplies.

**Recommendation:** standardize on one pattern — `rxResource` (Angular 21) fits all four screens, gives cancellation, `.isLoading()`/`.error()` signals for free, and would delete ~80 lines.

### Dead code & abandoned refactors

### 🟡 PWA-ARCH-6 — Splash screen still shows the placeholder logo (abandoned after the logo swap)

Commit `1908821` ("Canviats els logos") introduced `public/images/logoMuixe.png` (used by login + favicon), but `SplashScreenComponent.logoUrl` still defaults to `'images/logo-placeholder.svg'` (`splash-screen.component.ts:25`) and **no caller ever sets the input** — so every real launch shows the placeholder. The `logoUrl` input is a dead API; the placeholder SVG is a zombie asset.

**Recommendation:** default to the real logo (or hardcode it and delete the input + placeholder file).

### 🔵 PWA-ARCH-7 — Assorted dead files and dead inputs

- `apps/pwa/src/app/app.scss` — empty, referenced by nothing (only `styles.scss` is built).
- `public/favicon.ico` — unused; `index.html:10` points at the PNG logo instead.
- `AttendanceButtonComponent.disabled` input — never passed by any parent, yet it's exactly what past events need (PWA-UX-2).
- `MeEvent.attendanceSummary` — arrives in every list item, never read by the PWA (see PWA-API-5).

**Recommendation:** delete the first two; *use* the latter two.

---

## 3. Error handling & network robustness

### 🟠 PWA-ERR-1 — Home converts every failure into "there are no events"

`HomeService.loadHomeData()` catches each inner request error and maps it to `of(null)` (`home.service.ts:20,27`), so the `error` branch of the subscriber in `home.component.ts:83-86` is unreachable. API down / 500 / timeout → home renders the empty state «No hi ha events propers programats.» — a member checking the next rehearsal on a dead connection is told there *is* no rehearsal. That's the most dangerous failure mode this screen has.

**Recommendation:** distinguish "both calls failed" from "no upcoming events" (e.g. `catchError` → a sentinel, or let `forkJoin` fail and show an error state with retry).

### 🟠 PWA-ERR-2 — Login reports every failure as wrong credentials

`login.component.ts:40-43` maps *any* error — network down, 500, and notably 429 (the API throttles auth at 10 req/min, so a colla logging in from the same venue Wi-Fi/NAT can genuinely hit it) — to «Correu electrònic o contrasenya incorrectes.» Users will "correct" a password that was never wrong.

**Recommendation:** branch on `HttpErrorResponse.status`: `401` → credentials; `429` → "massa intents, espereu un moment"; `0`/`5xx` → connection/server message.

### 🟡 PWA-ERR-3 — Interceptor's retry catch conflates refresh failure with retry failure (and spams toasts)

In `auth.interceptor.ts:27-41` the inner `catchError` sits after the `switchMap` that replays the original request, so it catches **both** a failed refresh **and** a failed retry. A request that 401s, refreshes fine, then fails with 500/403 on the retry → the user is logged out locally, told «La sessió ha expirat», and redirected to login — for a server hiccup. Additionally, N parallel requests failing together fire N identical toasts and N `router.navigate` calls.

**Recommendation:** scope the catch to the refresh observable only, rethrow retry errors untouched, and debounce the session-expired side effect (a flag in `AuthService` or `distinct` toast).

### 🟡 PWA-ERR-4 — Calendar season load fails silently

`loadAllSeasonEvents()`'s error path only stops the spinner (`event-list.component.ts:185-189`): no `hasError`, no toast. The user sees a fully rendered, event-less calendar — indistinguishable from a season with no events (same "absence rendered as data" failure as PWA-ERR-1).

**Recommendation:** reuse the list's `hasError` empty-state inside calendar mode, or toast the failure.

### 🟡 PWA-ERR-5 — Attendance errors discard the server's specific message

The API returns meaningful Catalan 400/403 messages — «No es pot modificar l'assistència d'un event passat» (`me.service.ts:148`), «No tens un perfil de persona associat al teu compte» (`:135`) — but the button always toasts the generic «No s'ha pogut actualitzar l'assistència.» (`attendance-button.component.ts:105`). The user taps again, fails again, learns nothing.

**Recommendation:** surface `err.error?.message` when present (they're already user-facing copy), fall back to the generic text. Better still, prevent the attempts (PWA-UX-2).

### 🟡 PWA-ERR-6 — No offline awareness anywhere

No `navigator.onLine` checks, no retry-with-backoff, no queued attendance updates. Every failure path is a dead end that relies on the user manually pulling to refresh. Acceptable for a first cut *with* a service worker roadmap; without one (PWA-ARCH-1) the app is strictly worse offline than the browser it runs in.

**Recommendation:** fold into the PWA-ARCH-1 work; meanwhile an `offline` banner via `fromEvent(window, 'online'/'offline')` is ~15 lines.

### 🔵 PWA-ERR-7 — Two small refresh races

1. `AuthService.refresh()` uses default `share()` (`auth.service.ts:71-85`): a subscriber that grabbed `_refreshInProgress$` just before completion but subscribes just after re-executes the POST (default `share` resets on complete). Harmless today, but `shareReplay({ bufferSize: 1, refCount: false })` + the existing null-guard is the intended shape.
2. `loadAllSeasonEvents()` has no `switchMap`/in-flight guard, so overlapping refreshes can resolve out of order (`event-list.component.ts:173-190`).

---

## 4. UX & interface consistency

### 🟠 PWA-UX-1 — Attendance is a blind 3-state cycle button

One button cycles ANIRE → NO_VAIG → PENDENT (`attendance-button.component.ts:23-27`). Consequences: (1) to decline from "Pendent" you must first tap through **"Vinc"** — which fires a real PUT announcing you're coming, visible to whoever watches the dashboard summaries, then a second PUT; (2) the label shows the *current* state but acts as a *button*, so it reads as "tap to confirm Vinc" when it actually flips to No vinc; (3) each intermediate hop toasts "Assistència actualitzada." twice. This is the app's core interaction — it deserves an explicit control.

**Recommendation:** replace with two segmented buttons (Vinc / No vinc, active state highlighted, third tap clears to Pendent), or a small action sheet. One tap = one intent = one PUT.

### 🟠 PWA-UX-2 — Attendance button is offered where it can only fail

- **Past events** ("Passats"/"Tots" tabs, past calendar days, past event detail): the API categorically rejects the PUT (PWA-API-2) — yet the button renders enabled everywhere.
- **Users without a linked person**: the shell shows the warning banner, but every card still renders a tappable button that will 403.

Both cases end in an optimistic flip → rollback → generic error toast (PWA-ERR-5). The component even has the `disabled` input ready — unused (PWA-ARCH-7).

**Recommendation:** pass `[disabled]` (or render a read-only chip) when `event.date < today` or `!auth.hasLinkedPerson()`.

### 🟡 PWA-UX-3 — Deep links are lost at login

`authGuard` redirects to `/login` without capturing the attempted URL (`auth.guard.ts:11`), and login always navigates to `/home` (`login.component.ts:39`). Opening a shared `/events/:id` link while logged out → login → home; the user has to find the event again. For a member app whose links will be shared in group chats, this is the first-session experience.

**Recommendation:** `router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })` and honor it after login.

### 🟡 PWA-UX-4 — Document title never changes

No route `title`s and no `TitleStrategy`; every history entry, browser tab and Android task-switcher card reads "MuixerApp". Also hurts screen-reader orientation (cross-ref PWA-A11Y-4).

**Recommendation:** add `title` per route (`Inici`, `Esdeveniments`, event name via resolver, `Perfil`).

### 🟡 PWA-UX-5 — Calendar dot colors are an unexplained code

Dots encode attendance × event type via color/outline (`calendar-view.component.ts:63-72`): filled secondary vs primary, red for declined (both types), outline for pending. There is no legend anywhere, and red-vs-outline semantics are guessable at best (also color-only for sighted users — cross-ref PWA-A11Y). `NO_VAIG` collapses both event types into the same red, losing the type distinction the other states keep.

**Recommendation:** add a one-line legend under the grid; consider dot shape (circle/square) for type instead of hue.

### 🟡 PWA-UX-6 — Brand inconsistency: placeholder splash logo + two competing theme colors

The runtime splash shows a placeholder SVG (PWA-ARCH-6), while `manifest.webmanifest`/`index.html` declare `theme_color #6d1a36` (burgundy) but the actual DaisyUI theme paints primary `#1E3A8A` (blue) (`tailwind.config.js:129`). Installed-app chrome, OS splash and in-app UI disagree about the brand color.

**Recommendation:** pick one primary; align manifest `theme_color`, `<meta name="theme-color">`, and `generateCollaTheme(...)`.

### 🟡 PWA-UX-7 — Error states tell users to retry but give them nothing to press

The list error renders `app-empty-state` with «…Torna-ho a provar.» (`event-list.component.html:43`) — no retry button; the only retry path is pull-to-refresh, which is undiscoverable when the screen shows a static message (and is touch-only: desktop/keyboard users have zero recovery). Event detail's error card has no retry either (`event-detail.component.html:8-13`).

**Recommendation:** give `app-empty-state` an optional action button ("Torna-ho a provar") wired to the reload methods that already exist.

### 🔵 PWA-UX-8 — Calendar niceties

Opens on the device's current month even when it holds no events (e.g. off-season August); month navigation is unbounded into empty years; tapping an event-less day selects it with no feedback (highlight only). Consider: initial month = first upcoming event; clamp navigation to the season; show "Cap esdeveniment aquest dia" for empty selections.

### 🔵 PWA-UX-9 — Login form details

Password field shows no inline error text (email does — `login.component.html:49-55` vs none for password); `Validators.minLength(6)` at *login* will block a legacy 5-char password from ever reaching the server; no show-password toggle (mobile typing); submit stays `disabled` while invalid, so tapping it gives untouched fields no validation feedback.

### 🔵 PWA-UX-10 — iOS install experience unaddressed

No `apple-touch-icon`, no `apple-mobile-web-app-`* meta. On iOS (a colla will have plenty of iPhones) Add-to-Home-Screen falls back to a screenshot icon and browser-chrome behavior. Cheap to add alongside PWA-ARCH-1.

---

## 5. Accessibility

### 🟡 PWA-A11Y-1 — ARIA tab semantics claimed but not implemented (twice)

- Bottom navigation: `role="tablist"`/`role="tab"` + `aria-selected` on what are router **links** (`bottom-tab-bar.component.ts:17-33`). No `tabpanel`, no roving tabindex, no arrow-key model — screen readers announce a tab widget whose keyboard contract then fails. Navigation should be `<nav>` + links with `aria-current="page"`.
- Event list filter: same `role="tablist"`/`tab`/`aria-selected` on plain buttons (`event-list.component.html:5-18`), again without `aria-controls`/`tabpanel`/arrow keys.

**Recommendation:** drop the tab roles (bottom bar), or complete the APG tabs pattern (filter), whichever is less work — half-ARIA is worse than none.

### 🟡 PWA-A11Y-2 — Clickable event card isn't keyboard/SR-interactive by contract

`event-card.component.html:1-9`: `role="article"` + `tabindex="0"` + `(click)`/`(keydown.enter)`. An "article" is not an interactive role, so screen readers won't announce it as activatable; Space does nothing (native buttons/links handle it, this div doesn't). The whole card is one tap target wrapping *another* interactive control (the attendance button), which also makes the accessible name (`aria-label` = title + subtitle) diverge from its visible content.

**Recommendation:** make the title a `routerLink` stretched over the card (CSS `::after` overlay), keeping the attendance button outside the link; delete the manual tabindex/keydown plumbing.

### 🟡 PWA-A11Y-3 — Calendar `role="grid"` without the grid keyboard model

`calendar-view.component.html:22-51` declares `grid`/`row`/`columnheader`/`gridcell`, but every current-month day is `tabindex="0"` (a ~30-stop Tab gauntlet) and there is no arrow/Home/End navigation, which the grid role promises. Non-month days are excluded via `pointer-events-none` + `tabindex -1` instead of `disabled`.

**Recommendation:** either implement roving tabindex + arrow keys, or drop to plain buttons in a labelled group (`role="group"` + `aria-label`), which is honest about the interaction. Use `disabled` for out-of-month cells.

### 🟡 PWA-A11Y-4 — No focus management or announcement on navigation

SPA route changes keep focus wherever it was (e.g. on the card you just tapped, now detached); combined with a never-changing document title (PWA-UX-4), screen-reader users get no signal that the screen changed. Angular's router does not do this for you.

**Recommendation:** on `NavigationEnd`, move focus to the `h1` in `MobileHeaderComponent` (`tabindex="-1"` + `.focus()`), and add per-route titles.

### 🔵 PWA-A11Y-5 — Live-region noise

Every toast is inside an `aria-live="polite"` container *and* has `role="status"` (double announcement, and errors arguably warrant `assertive`); each skeleton card is its own `role="status"` ("Carregant contingut" × 4); the entire list section is `aria-live="polite"` (`event-list.component.html:39`), so any re-render is read out; the attendance button self-announces via `aria-live` on label change — which after an error rollback re-announces the *old* state with no context.

**Recommendation:** one polite live region for toasts (drop per-toast `role`), one status node for loading, no `aria-live` on whole content sections.

### 🔵 PWA-A11Y-6 — Motion & misc

No `prefers-reduced-motion` handling for the pulse/spinner/slide-in animations; toasts auto-dismiss on a fixed 3–5s timer with no hover/focus pause (WCAG 2.2.1 leans longer for error text); `<html lang="ca">` is fine but `ca-valencia` would match the mandated variant (see §9).

---

## 6. Performance

### 🟡 PWA-PERF-1 — Google Fonts stylesheet is loaded, render-blocking… and the font is never used

`index.html:11-13` pulls Inter (4 weights) from `fonts.googleapis.com`, but **nothing references it**: `styles.scss` is only the three Tailwind directives, `tailwind.config.js` sets no `fontFamily`, and no component styles mention Inter. Every visitor pays a third-party DNS+TLS+CSS round-trip (render-blocking `<link rel="stylesheet">`) plus font downloads for a font the UI never renders. It's also the only third-party runtime dependency — a gratuitous GDPR/offline liability for a members' app.

**Recommendation:** delete the three lines (and the preconnects); if Inter is actually wanted, self-host (`@fontsource/inter`) and register it in Tailwind's `fontFamily.sans`.

### 🟡 PWA-PERF-2 — Caddy serves hashed assets with no cache headers

`apps/pwa/Caddyfile` sets no `Cache-Control` at all. Consequences in both directions: immutable, content-hashed `main-*.js` bundles get heuristic caching (re-validated or re-downloaded needlessly on mobile), while `index.html` *may* be heuristically cached (stale deploys — users keep referencing old hashed bundles that were removed, i.e. a broken app until a hard refresh).

**Recommendation:**

```caddy
@immutable path *.js *.css *.woff2
header @immutable Cache-Control "public, max-age=31536000, immutable"
header /index.html Cache-Control "no-cache"
```

### 🟡 PWA-PERF-3 — Template-invoked function allocates on every change-detection pass

`SkeletonCardComponent.items` is an arrow function called from `@for` (`skeleton-card.component.ts:27`) — a new array per CD cycle while visible. Trivial today, but it's the exact pattern the signals architecture exists to avoid, and it's in the shared component most screens render first.

**Recommendation:** `protected readonly items = computed(() => Array.from({ length: this.count() }));`

### 🔵 PWA-PERF-4 — Payload/request economies

Home issues two parallel `/me/events` requests to obtain one event each (`home.service.ts:16-29`) — one `limit:2` upcoming call, split client-side, halves that; every `MeEvent` carries `attendanceSummary` the PWA never displays (cross-ref PWA-API-5). Neither matters at current scale; both are free wins when touching the endpoint anyway.

---

## 7. API contract drift

### 🟠 PWA-API-1 — `PaginatedResponse.meta` is dead weight to the PWA; server caps make full data unreachable

The PWA types every list call as `PaginatedResponse<MeEvent>` but reads only `.data` — `meta.total/page/limit` are never consulted (`event-list.component.ts:112`, `home.service.ts:19-27`). Combined with the DTO's `@Max(100)` (`me-event-filter.dto.ts:26`), the calendar's single `limit:100` request is structurally unable to fetch a long season, and nothing detects it (PWA-BUG-6). The contract offers pagination; the client pretends it doesn't exist.

**Recommendation:** honor `meta.total` (page the calendar fetch; paginate/infinite-scroll the list).

### 🟠 PWA-API-2 — Server forbids past-event attendance; client UI doesn't know

`PUT /me/events/:id/attendance` rejects any event with `date < today` (`me.service.ts:143-149`, 400 «No es pot modificar l'assistència d'un event passat»), computed in `Europe/Madrid`. The PWA renders enabled attendance buttons on every past event and swallows the message (PWA-UX-2, PWA-ERR-5). Note the client would compare dates in *device* timezone — for members abroad the "today" boundary can differ from the server's; mirror the rule but treat the server as authoritative.

**Recommendation:** encode the rule client-side (`event.date < todayLocal` → disabled), keep server message surfacing as the safety net.

### 🟡 PWA-API-3 — Status vocabulary asymmetry: client cycle matches the write whitelist but not the read domain

`UpdateMyAttendanceDto` whitelists exactly `PENDENT|ANIRE|NO_VAIG` (`update-my-attendance.dto.ts:4-8`) — the PWA's cycle matches the *write* contract perfectly. But the *read* contract returns the full `AttendanceStatus`, including `ASSISTIT`, which the UI mishandles (PWA-BUG-3). A client that writes a 3-value enum but reads a 4-value one must render all four.

### 🟡 PWA-API-4 — Triplicated auth response types (shared lib exists, unused by both frontends)

See PWA-ARCH-2: `UserProfile`/`PersonSummary` live in `@muixer/shared` *and* in each app's `auth.models.ts`. The PWA copy is word-for-word identical today, which is precisely how drift starts. `AuthResponse`/`LoginRequest` (with `clientType: ClientType`) aren't in the shared lib at all despite the server validating them.

### 🔵 PWA-API-5 — Unused response fields & minor notes

- `MeEvent.attendanceSummary` is mandatory in the contract, serialized for every event, and never read by the PWA — either the PWA will grow a "how many are coming" UI (likely, keep it) or it should be trimmed from `/me/events`.
- `/auth/refresh` fails with **403** (not 401) when the cookie is missing/invalid (`auth.controller.ts:89`) — the interceptor's 401-only retry handles this correctly by accident (refresh errors propagate to the session-expired path); worth a comment so nobody "fixes" it.
- `timeFilter` defaults to `'upcoming'` on both sides independently (`event.service.ts` always sends it; DTO defaults it) — harmless duplication.

---

## 8. Code smells & conventions

### 🟡 PWA-SM-1 — Inline native `onerror` handler in an Angular template

`login.component.html:14`: `onerror="this.style.display='none'"`. It bypasses Angular's event system, will be blocked by any future CSP (inline handlers need `unsafe-inline`/`unsafe-hashes`), and hides the logo silently rather than fixing the path. Use `(error)="logoFailed.set(true)"` + `@if`.

### 🟡 PWA-SM-2 — A roles guard that whitelists every role

`rolesGuard(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN)` (`app.routes.ts:24`) — the set of all existing roles — is authorization theater: it can never reject anyone `authGuard` admits, yet reads as if it enforces something. Either drop it (auth-only is the actual policy) or keep it *and* fix the redirect loop it would cause the day a fourth role exists (PWA-BUG-7).

### 🟡 PWA-SM-3 — Stringly-typed status maps defeat the compiler

`STATUS_CONFIG: Record<string, …>` and `DOT_CLASSES: Record<string, …>` with `?? fallback` chains (`attendance-button.component.ts:17`, `calendar-view.component.ts:63`). Typed as `Record<AttendanceStatus, …>` (or a `satisfies` map), the missing `ASSISTIT` entry (PWA-BUG-3) would have been a **compile error** instead of a shipped bug. The fallbacks currently reward incompleteness by making it invisible.

### 🟡 PWA-SM-4 — Non-null assertion parade in the detail template

`event-detail.component.html` uses `event()!.` twelve times inside a branch already guarded by `@else`. `@if (event(); as ev)` gives the same narrowing with zero assertions and one signal read.

### 🔵 PWA-SM-5 — Magic numbers

Page sizes 50/100 (`event-list.component.ts:169,176`), swipe threshold 50 (`calendar-view.component.ts:74`), pull threshold 60 (`pull-to-refresh.component.ts:41`), toast durations 3000/5000 (`toast.service.ts`), `z-[9999]` twice. Named constants would make PWA-BUG-6's caps greppable.

### 🔵 PWA-SM-6 — Safe-area handling implemented three different ways

Inline `style` on the login wrapper (`login.component.html:3-6`), a bespoke `.pt-safe-top` class in the shell (`app-shell.component.ts:25-27`), inline `style` again on the tab bar and toast container. One Tailwind utility (v3 arbitrary values: `pt-[env(safe-area-inset-top)]` or a tiny plugin) would unify them.

### 🔵 PWA-SM-7 — Small inconsistencies

- `viewChild` visibility differs for the same thing (`private` in event-list, `protected` in home).
- `event-list.component.ts:154` fabricates `myAttendance.id: ''` and a client-side `respondedAt` when patching — a lie in the model that works only because nothing reads those fields.
- `pull-to-refresh.component.ts:73` checks `el.scrollTop === 0` on its own host, which is never scrollable — dead condition (the `window.scrollY` check is the live one).
- `environment.pre.ts` vs the dashboard's environment naming is consistent, but the PWA lacks a `production` file replacement config entirely (the `production` build configuration ships `production: false`, `apiUrl: '/api'` — fine today because the values coincide, a trap the day they diverge).

---

## 9. UI text / language

The project rule (`.agents/skills/language-rules`) mandates **Valencian**, «vós» treatment, no bare gerunds, imperative-2sg for user→app orders, and no anglicisms. The PWA's copy is consistently central-Catalan «tu» and uses the English "events". All occurrences verified in source.

### 🟠 PWA-LANG-1 — "Events" anglicism across the whole app

User-visible «event(s)» appears in at least 9 strings: tab label «Events» (`bottom-tab-bar.component.ts:45`), header «Events» (`event-list.component.html:1`), «Filtre d'events» (`:5`), «Error carregant els events…» (`:43`), «Events del …» (`:73`), empty messages «No hi ha events propers/passats…» (`event-list.component.ts:87-89`, `home.component.html:29`), «Detall event» / «No s'ha pogut carregar l'event.» (`event-detail.component.html:2,11`). Per the style guide this should be «esdeveniments» (or the domain terms «assajos i actuacions»; «Agenda» works well for the tab). The dashboard shares this habit in places, but the PWA is the member-facing surface.

### 🟡 PWA-LANG-2 — User addressed as «tu» instead of «vós»

- «La sessió ha expirat. **Torna** a entrar.» (`auth.interceptor.ts:38`) → «Torneu a entrar.» (and «ha caducat» is the consolidated term for *expired*).
- «…Torna-ho a provar.» (`event-list.component.html:43`) → «Torneu-ho a provar.»
- «**El teu** compte no està vinculat… **Contacta** amb l'equip tècnic.» (`no-person-banner.component.ts:13-16`) → «El compte no està vinculat… Contacteu amb l'equip tècnic.» (guide also says drop unneeded possessives).
- «**Has oblidat** la contrasenya? **Contacta**…» (`login.component.html:106`) → «Heu oblidat la contrasenya? Contacteu…»

### 🟡 PWA-LANG-3 — Bare gerunds for in-progress states

Guide: «S'està…», never the gerund alone. Violations: «Entrant...» (`login.component.html:98`) → «S'està entrant...» (better: «S'està iniciant la sessió...»); «Actualitzant…» (`pull-to-refresh.component.ts:27`) → «S'està actualitzant...»; aria-labels «Carregant aplicació» (`splash-screen.component.ts:11`) and «Carregant contingut» (`skeleton-card.component.ts:13`) → «S'està carregant l'aplicació/el contingut...» (articles are also mandatory).

### 🟡 PWA-LANG-4 — Infinitives used as commands on controls

User→app orders take imperative 2sg: «**Tornar** enrere» (`mobile-header.component.ts:21`) → «Torna enrere»; «**Tancar**» (`toast-container.component.ts:39`) → «Tanca»; «**Veure** calendari / **Veure** llista» (`event-list.component.html:26`) → «Mostra el calendari / Mostra la llista». (The login button «Entra» is correct.)

### 🟡 PWA-LANG-5 — Message-form violations

- «Error carregant els events. Torna-ho a provar.» — error noun + gerund + anglicism + tu, four rules in one string → «S'ha produït un error en carregar els esdeveniments. Torneu-ho a provar.»
- «Assistència actualitzada.» (`attendance-button.component.ts:99`) — participle-only success message → «S'ha actualitzat l'assistència.»
- «Detall event» (`event-detail.component.html:2`) — missing preposition/article → «Detall de l'esdeveniment».

### 🔵 PWA-LANG-6 — Valencian variant and consistency notes

No text uses Valencian-preferred forms yet (the guide's `este/eixe`, «hui», «caducat», etc. — e.g. «ha expirat» → «ha caducat»); tabs say «Propers» while home headings say «Pròxim/Pròxima» (pick one family, guide leans «pròxims»); `index.html` declares `lang="ca"` — `ca-valencia` would match the mandated variant. Also «Hola, X!» is fine, but the guide reserves «!» for grave warnings — «Hola, X» reads equally warm in UI copy.

---

## 10. Tests

**Executed, not just read:** `nx test pwa` → 16 spec files, **103 tests, all passing** in ~1.7s (Vitest 4 via `@angular/build:unit-test`). `nx lint pwa` → clean. Coverage (V8): **88.1% statements / 87.8% branches / 90.7% lines** over the files the specs touch. The suite is genuinely good for a WIP app — behavior-driven (rendering, interaction, error paths), and it covers non-trivial cases: refresh deduplication, optimistic rollback, calendar grid math, month swipes, filter switching.

### 🟠 PWA-TEST-1 — The PWA is excluded from CI: tests *and* build never run

`.github/workflows/ci.yml:75,79,88,92` pass `--exclude=dashboard-e2e,pwa-e2e,pwa` to **both** the test and the build steps (all-runs and affected-runs alike; only `lint` includes the PWA). So the 103 green tests protect nothing on a PR, and a PWA that doesn't even compile can merge to `main` — it would only be discovered when the pre-stack Docker build runs at deploy time. On top of that, `apps/pwa/project.json:91-93` defines the `ci` test configuration as `"coverage": false`, whereas the dashboard's is `"coverage": true, "runnerConfig": true` (the 70% gate from `CLAUDE.md`) — so even once un-excluded, the PWA would skip the coverage gate the repo convention promises. (`pnpm run ci:local` does include the PWA — local and CI disagree.)

**Recommendation:** remove `pwa` from the two exclude lists and mirror the dashboard's `ci` test configuration. If the exclusion was a WIP stopgap, it has outlived its purpose — the suite is green.

### 🟡 PWA-TEST-2 — Two specs enshrine bugs as expected behavior

- `auth.interceptor.spec.ts:65-72` — *"skips Bearer for /auth/ URLs"* asserts that `Authorization` is **absent** on `/api/auth/`* requests. That assertion is the spec-level twin of PWA-BUG-2 (logout can never authenticate); fixing the bug requires flipping this test, and until then the test suite actively defends the defect.
- `home.service.spec.ts:96-100` — *"should handle API error gracefully and return null"* asserts the error→`null`→empty-state masking of PWA-ERR-1. "Gracefully" here means "indistinguishable from no events".

**Recommendation:** when fixing PWA-BUG-2 / PWA-ERR-1, rewrite these tests to specify the *intended* behavior first (they're ready-made TDD anchors).

### 🟡 PWA-TEST-3 — Coverage holes sit exactly where the untested logic lives, and the headline number hides them

- `pull-to-refresh.component.ts` — **42.9% stmts / 43.8% branches**: the entire touch state machine (`onTouchStart/Move/End`, threshold, reset paths) is unexercised; it's also where PWA-BUG-8 lives.
- `toast-container.component.ts` — **40.6%**; `toast.service.ts` — **66.7%** (auto-dismiss timer and `dismiss` untested).
- `mobile-header.component.ts` — **33% functions**: `goBack()` untested (PWA-BUG-9's home).
- **No spec at all** for: `app-shell`, `bottom-tab-bar`, `splash-screen`, `skeleton-card`, `empty-state`, `no-person-banner`, `toast-container`, `toast.service`, `pull-to-refresh` (indirectly touched only), `profile`.

Note the V8 report only includes files imported by some spec — the spec-less components above are invisible to it, so the true all-files coverage is meaningfully below the reported 88%.

**Recommendation:** prioritize a `pull-to-refresh` spec (pure logic, easy to drive with synthetic `TouchEvent`s) and a `toast.service` spec (fake timers); enable "all files" coverage (`coverage.all` / include globs) so gaps are visible.

### 🔵 PWA-TEST-4 — Missing scenarios that would have caught this report's bugs

A checklist for the next test pass, each mapping to a finding: `ASSISTIT` rendering + cycle exclusion (PWA-BUG-3); attendance change in *list* mode patches `allSeasonEvents` (PWA-BUG-4); tap-while-pending is ignored (exists implicitly, no assertion); event-detail refetch on `:id` change (PWA-BUG-5); `>50`/`>100` result truncation surfacing (PWA-BUG-6); diagonal swipe does not flip month / does not trigger refresh (PWA-BUG-8); back-button fallback without history (PWA-BUG-9); login error branches by status code (PWA-ERR-2); interceptor retry-failure ≠ session expiry (PWA-ERR-3).