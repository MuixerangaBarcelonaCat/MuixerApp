# Person data minimization by audience

> **Date:** 10 September 2026
> **Status:** Reviewed design, pending implementation
> **Baseline:** `develop` at `e4c1127b`
> **Scope:** Staff access control and response minimization for person/account data

## 1. Goal and limits

Reduce person and account data exposed to each audience:

- `ADMIN` can read and edit protected registration/contact data.
- `TECHNICAL` can read and edit only the operational data needed for attendance, staffing
  figures and member administration.
- The Dashboard census list shows a `TECHNICAL` only the person's name and alias.
- A `MEMBER` keeps access to their own account data and a primary guardian keeps the existing
  access to a dependent's registration data.
- Shared member-facing views, especially projection, must not carry another person's protected
  or technical-only data in the network response.

This is a data-minimization and authorization change. It does not by itself make the product
fully GDPR/LOPDGDD compliant; the wider compliance work and remaining obligations stay in
`docs/GDPR_COMPLIANCE.md` and `docs/DEBT.md`.

The API is the security boundary. Hiding a field or disabling a control in Angular is not an
authorization mechanism.

## 2. Verified current-state findings

The previous version of this specification was based on stale `main` and is discarded. The
current `develop` branch differs materially:

1. `Person` has `gender`, `notesEmoji`, `joinDate` and an inverse `user` relation. It has no
   email column; account email lives on `User`.
2. `PersonResponseDto` exposes every registration field and nested `user.email` to both
   `TECHNICAL` and `ADMIN`.
3. `AuthService.isAdmin` already exists in the Dashboard.
4. The PWA is implemented. Its member projection currently receives every assigned person's
   surname, shoulder height, technical notes and notes emoji.
5. Attendance, node assignments, event participation and push-device summaries expose surnames
   through response shapes unrelated to `PersonResponseDto`.
6. Staff and member delegation responses expose delegate email addresses.
7. The Dashboard delegate picker depends on `GET /users`, searches by email/name and displays
   email addresses.
8. `GET /users` and most account mutations currently allow `TECHNICAL`.
9. `GET /persons` searches surnames and permits sorting by surname, phone and birth date.
   Attendance search also includes surname. Available-person search already uses only alias/name.
10. Technical observations (`notes` and `notesEmoji`) are used by attendance, pinya/tronc hover
    cards and event participation. They are operational data, not ADMIN-only notes.
11. The only current Dashboard entry point to `/config/users` is the card in `ConfigComponent`;
    the stale Home-page entry no longer exists.
12. `GET /persons/:id` writes an audit entry before confirming that the person exists and does so
    for both roles, while bulk protected reads are not represented.

## 3. Audience and field policy

All of these values are personal data in the legal sense. The distinction below is purpose and
audience, not whether a value is personal.

### 3.1 Protected registration and account data

Staff access is `ADMIN`-only:

- `firstSurname`
- `secondSurname`
- `phone`
- `birthDate`
- `gender`
- linked-account email
- delegate email
- full account-management fields such as role, invite expiry and account timestamps

Exceptions are identity-bound:

- an authenticated user may receive their own account/profile values through auth/profile flows;
- a valid invite token may receive the registration context needed to complete that invitation;
- an active primary guardian may receive and complete the existing pending-dependent
  registration data.

These exceptions do not grant directory access to other people.

### 3.2 Operational staff data

`TECHNICAL` and `ADMIN` may receive these values only in workflows that need them:

- `id`, `alias`, `name`
- `shoulderHeight`
- `notes`, `notesEmoji`
- positions/tags and `tagCompliance`
- `availability`, `onboardingStatus`
- `isActive`, `isMember`, `isProvisional`, `isXicalla`
- `shirtDate`
- attendance status/counts, placements and conflicts
- a derived account state (`NONE`, `PENDING_ACTIVATION`, `ACTIVE`)

`notes` and `notesEmoji` are technical observations. Ordinary `MEMBER` projection responses must
not contain them.

### 3.3 Internal-only data

No new response contract exposes:

- `legacyId`, `lastSyncedAt`
- password hashes, invite/reset/refresh tokens or consent internals
- raw relation entities
- account IDs outside a command/candidate contract that actually needs one

`joinDate` and mentor are not exposed or made TECHNICAL-editable by this change because no current
Dashboard workflow uses them.

## 4. Approaches considered

### 4.1 Explicit audience-specific DTOs and mappers — selected

Define narrow response contracts for census, operational staff detail, ADMIN detail, delegation
candidates and member projection. Map entities explicitly and select only the columns required by
the audience.

Advantages:

- forbidden keys are visibly absent from the TypeScript and Swagger contracts;
- list, detail, projection and delegation can have different legitimate shapes;
- domain methods called by `AuthService` and `MeService` remain independent of an HTTP role;
- mapper and endpoint tests can assert actual key absence;
- adding an entity column does not expose it automatically.

This is the simplest secure solution for the current architecture. It uses more declarations than
one broad DTO, but less hidden machinery and fewer regression paths.

### 4.2 `class-transformer` groups on `PersonResponseDto` — rejected

Groups would reduce declarations, but they are not a sufficient primary boundary here:

- conversions are manual and every call must pass the correct group;
- nested `user.email` needs independent grouping;
- `PersonService.update` is also called from auth and dependent-completion flows;
- attendance, assignments, participation, delegates, projection and device summaries use
  separate response shapes;
- groups do not stop protected-field search, sorting or query over-fetching.

### 4.3 Separate ADMIN URLs or a global role-aware interceptor — rejected

Duplicating all person routes under an ADMIN prefix creates parallel services and frontend paths.
A global interceptor that removes keys by name is too broad: fields such as `name` and `notes`
have unrelated meanings in other domains. Neither option removes the need for endpoint-specific
projection and delegation contracts.

## 5. Backend design

### 5.1 Person read contracts

Replace the broad common response with explicit contracts and pure mappers:

- `TechnicalPersonDirectoryItemDto`: `id`, `name`, `alias` and `positions`. The positions are
  required by the existing technical tag-detail page; the census itself still renders only
  name/alias.
- `AdminPersonListItemDto`: all currently supported census fields (`positions`, `tagCompliance`,
  `attendedCount`, status/availability fields, shoulder height, technical observations,
  shirt date and created/updated timestamps) plus protected registration data and narrow
  linked-account details; never internal fields.
- `OperationalPersonDetailDto`: operational staff data plus derived `accountState`, without a
  nested `User`.
- `AdminPersonDetailDto`: operational detail plus protected registration fields and a narrow
  linked-account reference containing `id`, `email` and state.

`GET /persons` and `GET /persons/:id` receive `@CurrentUser()` at the controller boundary and call
the appropriate query/mapper. A `TECHNICAL` response must not contain protected keys, including
keys with `null` values.

The list query for `TECHNICAL` selects only `id`, `name`, `alias` and positions for its result
rows. It may still apply operational filters server-side. The detail query selects the
operational contract. The ADMIN variants select the fields their contracts expose.

`GET /persons` remains the shared directory used by the census, person search and tag detail.
Do not collapse it to three fields unless tag detail is migrated to a separate operational
endpoint. The selected four-field TECHNICAL contract is the smaller change and preserves the
current tag workflow.

Business mutations continue to work with entities internally. A domain method must not return a
role-dependent DTO to `AuthService` or `MeService`.

### 5.2 Search and sort inference

For `TECHNICAL`:

- census search uses only `alias` and `name`;
- census sort accepts only `alias` and `name`;
- forcing any other globally valid sort field (including protected fields and hidden operational
  fields such as height or attendance count) returns `403` rather than silently sorting by a
  replacement field.

For `ADMIN`, surname search and the existing protected sort fields remain available.

Also remove surname from:

- `AttendanceService.findByEvent` search;
- client-side event-participation search;
- PWA technical roll-call search;
- PWA member projection participant search.

`UserService.findAll` may keep email/surname search because the whole management endpoint becomes
ADMIN-only.

### 5.3 Person mutations

Authorization is enforced before assigning DTO fields:

- `POST /persons` (full person creation) is ADMIN-only.
- `POST /persons/provisional` remains `TECHNICAL`/`ADMIN` and accepts only alias.
- ADMIN may patch every currently supported person field.
- TECHNICAL may patch only:
  `name`, `alias`, `shoulderHeight`, `notes`, `notesEmoji`, `isActive`, `isMember`, `isXicalla`,
  `availability`, `onboardingStatus`, `shirtDate` and `positionIds`.
- TECHNICAL may set `isProvisional: true`; setting it to `false` is ADMIN-only because manual
  promotion validates hidden registration/account data. Invite activation and primary-guardian
  dependent completion keep their existing promotion paths.
- A request containing any forbidden key fails as a whole with `403`; fields are not silently
  discarded.
- `DELETE /persons/:id` and `PATCH /persons/:id/activate` remain operational
  `TECHNICAL`/`ADMIN` actions.

Use a staff-facing application method or policy function for this check. Keep the internal
transactional update used by invite registration/dependent completion role-free and unreachable
as an HTTP bypass.

Every HTTP mutation also returns an audience-safe contract:

- full creation returns `AdminPersonDetailDto`;
- provisional creation, update and activation return `OperationalPersonDetailDto` to
  `TECHNICAL` and `AdminPersonDetailDto` to `ADMIN`;
- deletion remains `204`.

No mutation response may reuse the current broad `PersonResponseDto`.

### 5.4 Account management and invitations

`UserController` management handlers become ADMIN-only:

- list users;
- create staff accounts;
- update email/role/state;
- deactivate accounts (reactivation remains the existing `updateUser` state change);
- grant roles.

`POST /users/invite-link` remains explicitly `TECHNICAL`/`ADMIN`. It is a focused onboarding
capability that takes a person ID and does not require the caller to read an email address.
Nest's existing `getAllAndOverride` role behavior supports this handler-level exception.

Dashboard `/config/users`, its card and direct route are ADMIN-only. `AuthService.isAdmin` is
reused; no duplicate role signal is added.

### 5.5 Delegations without email disclosure

Do not use `GET /users` from the technical delegate modal.

Add a person-scoped delegation-candidate endpoint for `TECHNICAL`/`ADMIN` that:

- searches only linked-person `alias` and `name`;
- excludes existing delegates;
- returns a narrow candidate command reference (`candidateUserId`, `personId`, `alias`, `name`,
  `accountState`);
- does not return email, surname or other registration fields.

Technical/member delegate responses contain delegate ID, type/state and linked-person
`id`/`alias`; they omit email. ADMIN staff responses include the delegate email. Member creation
by alias remains unchanged.

A user without a linked `Person` cannot be meaningfully identified without email. Such an account
is not offered to `TECHNICAL` or `MEMBER` as a new candidate; ADMIN repairs or manages it from the
Users screen. If an existing delegation already references such an account, non-admin UI shows
«Compte sense perfil» and still permits removal by delegate ID.

### 5.6 Attendance, assignments and participation

Remove `firstSurname` from the following response contracts and all matching UI code:

- `AttendancePersonRef`;
- `AvailablePersonDto`;
- `AssignmentDetail.person`;
- `EventParticipationPerson`;
- the corresponding `@muixer/pinyes-render`, shared and Dashboard/PWA models.

Keep alias/name and the operational values required by staff: shoulder height, technical
observations, xicalla state, tags, attendance and placement/conflict data.

Update fallback labels to alias, then name. A missing alias must never reintroduce surname.

### 5.7 Projection audiences

The Dashboard and PWA currently share `ProjectionService`, but their audiences differ. Make the
projection audience a required `staff | member` option with no default:

- staff projection person: `id`, `alias`, `name`, `shoulderHeight`, `notes`, `notesEmoji`;
- member projection person: `id`, `alias`, `name`.

`EventSegmentController` requests the staff contract. `MeService.findSegmentProjection` requests
the member contract and still requires a published segment. Do not infer audience from
`onlyPublished`.

Protected/technical-only keys must be absent from the member HTTP response, not sent as `null` and
not merely hidden by the PWA. Renderer adapters/types must accept the smaller member identity
without restoring fake protected fields.

### 5.8 Push-device summary

`GET /push-subscriptions/summary` remains a staff operational endpoint, but its person reference
changes from first/last name to `id`, `alias`, `name`. SQL selection, ordering, shared
`DeviceSummary`, Dashboard display/search and tests change together.

### 5.9 Self and guardian boundaries

Keep these current identity-bound flows:

- `/auth/me` and authenticated account changes for the caller's own account;
- invite-context/registration for the holder of a valid invite token;
- pending-dependent registration for an active primary guardian;
- managed-person profile summary after `assertCanManagePerson`.

This change does not add a new general profile editor. Secondary delegates and unrelated members
do not gain registration-data access.

### 5.10 Audit behavior

Keep audit records free of names, aliases, emails, phone numbers, notes and field values.

- Record `SENSITIVE_DATA_ACCESS` only after a person detail lookup succeeds. Metadata identifies
  whether the returned scope was `operational` or `protected`.
- Record one aggregate access for successful ADMIN census/user-list reads that contain protected
  data; metadata may contain role, route, page and result count, never query text or returned
  values.
- Do not create audit rows for failed/404 lookups.

Wider audit expansion, retention and export auditing remain governed by
`docs/GDPR_COMPLIANCE.md` and `docs/DEBT.md`.

## 6. Frontend design

### 6.1 Dashboard census

For `TECHNICAL`:

- render exactly two data columns: `Àlies` and `Nom`;
- keep the row action that opens operational detail;
- do not render the column toggle;
- sanitize/ignore previously persisted ADMIN column preferences.

For `ADMIN`, retain the configurable full list. Build allowed columns from `auth.isAdmin()` and
intersect persisted keys with that set before passing columns to both the table and toggle.

### 6.2 Dashboard person detail

For `TECHNICAL`, render and edit only operational fields. Do not render surnames, phone, birth
date, gender, linked/delegate emails or controls for them.

For `ADMIN`, render/edit the protected registration fields, including `gender`, which the API
currently exposes but the Dashboard model/form omits.

Save payloads use explicit allowlists. They are never built by spreading `getRawValue()`:
disabled Angular controls are included in `getRawValue()` and absent response fields are patched
as empty strings. The backend check remains authoritative.

Show manual promotion only to ADMIN. A TECHNICAL viewing a regular person may still use
«Marcar provisional»; a TECHNICAL viewing a provisional person does not see the promotion action.
TECHNICAL may also create provisional people and use invitation/dependent workflows.

### 6.3 Dashboard accounts and delegations

- Guard `/config/users` with `rolesGuard(UserRole.ADMIN)`.
- Show the Users config card only when `auth.isAdmin()`.
- Replace `UserService` in the delegate modal with the narrow candidate endpoint.
- Display alias/name and account state, never email, to TECHNICAL.

### 6.4 Other Dashboard surfaces

Remove surname display/search/fallback usage from:

- attendance list, attendance confirmation and attendance edit modal;
- event participation;
- person search input;
- pinya/tronc person panels and assignment fallbacks;
- notification person selection;
- subscribed-device list.

Technical observations remain available in staff attendance and pinyes UI.

### 6.5 PWA

- Keep self invite registration and primary-dependent completion unchanged.
- Keep managed profile surname only where the backend has verified self/primary management.
- Remove co-delegate email fallback; use linked alias or a generic account label.
- Remove surname from technical roll call.
- Search member projection participants by alias/name only.
- Ensure member projection network data contains no surname, height, technical notes or emoji.

Do not remove `firstSurname` from the auth/self-registration contracts globally: those are
identity-bound and legitimate. Remove it only from directory, staff-operational and shared
projection/assignment contracts.

## 7. Error behavior

- Unauthorized route: existing role guard behavior (`403` at the API boundary).
- Forbidden field in a TECHNICAL patch: `403` with a Catalan user-facing message that does not
  echo values.
- Unsupported technical sort field: an explicit post-validation role policy returns `403`; the
  global DTO validation continues to return `400` for values outside the global sort whitelist.
  There is no silent fallback.
- Candidate with no linked/eligible account: not returned by candidate search.
- Missing alias target in member delegation: existing generic `404`; do not reveal whether an
  email/account exists.

## 8. Test strategy

Implementation follows TDD: each boundary test must fail for the current exposure before the
production change is written.

### Backend

1. Person list/detail contract tests assert exact keys for TECHNICAL and ADMIN.
2. Integration tests inspect serialized JSON, not only class instances.
3. TECHNICAL search cannot match a surname and cannot sort by any field other than alias/name,
   including hidden operational fields that remain in the global sort whitelist.
4. Every protected TECHNICAL patch key is rejected, including mixed allowed/forbidden payloads.
5. Provisional-create, update and activate responses omit protected keys for TECHNICAL.
6. ADMIN can create/update protected registration data.
7. Full Users management rejects TECHNICAL; invite-link creation still accepts it.
8. Candidate/delegate responses omit email for TECHNICAL and MEMBER, including existing delegates
   whose user has no linked person.
9. Attendance, assignment, available-person, participation and device-summary responses omit
   surname.
10. MEMBER projection omits surname, height, notes and emoji; staff projection retains its
   operational fields.
11. Existing self/invite/primary-guardian integration tests remain green; secondary/unrelated
    access stays forbidden.
12. Audit tests prove successful protected reads are recorded after lookup and failed lookups are
    not.

### Dashboard

1. TECHNICAL census renders only alias/name and no column toggle, even with hostile/stale
   `localStorage`.
2. ADMIN retains allowed columns and protected values.
3. TECHNICAL detail has no protected controls and sends only operational keys.
4. ADMIN detail includes gender and protected fields.
5. Users route/card are ADMIN-only.
6. Delegate picker uses alias/name candidates and never renders email.
7. Attendance, participation, pinyes and device-summary tests no longer rely on surname.
8. Tag detail still receives positions from the TECHNICAL directory contract.
9. Shared person search renders and searches alias/name without surname.

### PWA and renderer

1. Member projection participant search uses alias/name only.
2. The member projection fixture fails if forbidden keys are present in the HTTP contract.
3. Roll call does not require surname.
4. Delegate lists do not render email.
5. Auth and pending-dependent registration tests retain protected self/guardian fields.
6. Shared renderer tests use the correct staff or member person contract instead of dummy
   surname/notes fields.

Run the focused tests during each red-green cycle, then:

```bash
nx test api
nx test dashboard
nx test pwa
nx build api
nx build dashboard
nx build pwa
```

Run the relevant integration suite for role/serialization boundaries. No database migration is
expected.

## 9. Implementation slices

Implement in independently verifiable slices:

1. Person read DTOs/mappers, role-aware queries and search/sort restrictions.
2. Staff mutation authorization and role-specific Dashboard list/detail.
3. ADMIN Users management while preserving invite-link capability.
4. Delegation candidate/response minimization.
5. Attendance, assignment and event-participation surname removal.
6. Staff/member projection split and PWA cleanup.
7. Push-device summary minimization.
8. Audit alignment and full regression verification.

## 10. Expected file groups

Backend:

- `apps/api/src/modules/person/**`
- `apps/api/src/modules/user/**`
- `apps/api/src/modules/person-delegate/**`
- `apps/api/src/modules/event/attendance.service.ts`
- `apps/api/src/modules/node-assignment/**`
- `apps/api/src/modules/event-segment/projection.service.ts`
- `apps/api/src/modules/event-segment/event-segment.controller.ts`
- `apps/api/src/modules/me/**`
- `apps/api/src/modules/push-notification/push-subscription.service.ts`
- related controller/service/integration specifications

Shared/rendering:

- `libs/shared/src/interfaces/me/**`
- `libs/shared/src/interfaces/pinyes/event-participation.interfaces.ts`
- `libs/shared/src/interfaces/push-notification.interfaces.ts`
- `libs/pinyes-render/src/lib/models/assignment.model.ts`
- renderer fixtures/specifications affected by the narrower person contracts

Dashboard:

- `features/persons/**`
- `features/config/config.routes.ts`, `config.component.ts` and delegation/user components
- `features/config/components/tag-detail/**`
- `features/events/**` person-reference models/components
- `features/pinyes/**` person-reference consumers
- `features/communication/**` person/device consumers
- `shared/components/forms/person-search-input/**`
- related specifications

PWA:

- member projection, technical roll call, profile delegation and their specifications
- self-registration/dependent code only for regression typing/tests, not to remove authorized data

End-to-end:

- `apps/dashboard-e2e/src/audit/persons-audit.spec.ts`

## 11. Out of scope

- encryption at rest;
- hard deletion/anonymization and legacy re-import blocking;
- audit-log retention;
- legal-text changes or a claim of full legal compliance;
- new self-service profile functionality;
- database schema changes;
- unrelated UI/refactoring.
