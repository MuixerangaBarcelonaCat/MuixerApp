---
name: Persons page improvements
overview: "Comprehensive improvement of the /persons dashboard page: server-side column sorting, responsive table (always table with horizontal scroll), collapsible column selector, shoulder height relative mode, filter cleanup, and UX polish for non-expert users."
todos:
  - id: sort-backend
    content: Add sortBy/sortOrder to PersonFilterDto + dynamic ORDER BY in PersonService (with column whitelist)
    status: completed
  - id: sort-frontend
    content: Add sort signals to person-list component, clickable th headers with arrows, wire to API call
    status: completed
  - id: responsive-table
    content: Remove mobile card view, make table always visible with overflow-x-auto, sticky first column
    status: completed
  - id: collapsible-columns
    content: Wrap column selector in DaisyUI collapse (closed by default), show count
    status: completed
  - id: remove-filters
    content: Remove Membres and Xicalla toggle buttons, keep only Actius
    status: completed
  - id: shoulder-height
    content: Add shoulderHeightRelative toggle, compute +/- 140 display with color coding
    status: completed
  - id: ux-polish
    content: Cleaner filter layout, record count in title, per-page selector, sticky thead, skeleton loader, better visual hierarchy
    status: completed
  - id: test-audit
    content: Review existing tests and identify gaps in test coverage for persons feature
    status: completed
  - id: test-backend
    content: Update/add tests for PersonService (sorting logic), PersonFilterDto validation, PersonController
    status: completed
  - id: test-frontend
    content: Create tests for person-list.component (sorting, filters, shoulder height toggle, column visibility)
    status: completed
  - id: test-utils
    content: Add tests for http-params.util and person.util (shoulder height formatting)
    status: completed
isProject: false
---

# Persons Page Dashboard Improvements

## Current State

The persons list page ([person-list.component.ts](apps/dashboard/src/app/features/persons/components/person-list.component.ts)) has:

- Search with accent-insensitive matching (server-side)
- Position multi-select filter
- Toggle filters: Actius / Membres / Xicalla
- Column visibility selector (persisted in localStorage)
- Desktop table (`hidden lg:block`) + mobile card list (`lg:hidden`)
- Pagination with page numbers
- No sorting support (API hardcodes `ORDER BY person.alias ASC`)

---

## 1. Server-Side Column Sorting

**Backend** -- Add `sortBy` and `sortOrder` to the API:

- [person-filter.dto.ts](apps/api/src/modules/person/dto/person-filter.dto.ts): Add `sortBy?: string` (validated against allowed column names) and `sortOrder?: 'ASC' | 'DESC'`
- [person.service.ts](apps/api/src/modules/person/person.service.ts): Replace hardcoded `.orderBy('person.alias', 'ASC')` with dynamic `.orderBy(sortBy, sortOrder)`, with a whitelist map of allowed columns to prevent SQL injection

**Frontend** -- Click-to-sort on table headers:

- [person.model.ts](apps/dashboard/src/app/features/persons/models/person.model.ts): Add `sortBy` and `sortOrder` to `PersonFilterParams`
- [person-list.component.ts](apps/dashboard/src/app/features/persons/components/person-list.component.ts): Add `sortBy` / `sortOrder` signals; method `onSort(column)` that toggles ASC/DESC/none and calls `loadPersons()`
- [person-list.component.html](apps/dashboard/src/app/features/persons/components/person-list.component.html): Table `<th>` becomes clickable with sort indicator arrows (up/down/neutral)

Allowed sortable columns: `alias`, `name`, `firstSurname`, `email`, `shoulderHeight`, `birthDate`, `availability`, `isActive`, `createdAt`, `updatedAt`. Non-sortable: `positions`, `notes`.

---

## 2. Always-Table Responsive Layout (Remove Card List)

Current problem: Below `lg` breakpoint, the table is `hidden` and a card list appears. The user wants **always a table** with horizontal scroll.

Changes in [person-list.component.html](apps/dashboard/src/app/features/persons/components/person-list.component.html):

- Remove the entire `<!-- Mobile Cards (<lg) -->` block (lines 261-315)
- Remove `hidden lg:block` from the desktop table wrapper -- make it always visible
- Wrap the table in `overflow-x-auto` (already present on the card div) so it scrolls horizontally on narrow screens
- Add `whitespace-nowrap` to key cells to prevent wrapping that breaks table readability
- The first column (alias) could use `sticky left-0` so it stays visible while scrolling horizontally

---

## 3. Collapsible Column Selector

Currently the column toggle buttons are always visible below a divider, taking significant vertical space.

Change: Wrap them in a DaisyUI `collapse` component (closed by default):

```html
<div class="collapse collapse-arrow bg-base-200/50 rounded-lg">
  <input type="checkbox" />
  <div class="collapse-title text-sm font-medium py-2 min-h-0">
    Columnes visibles ({{ visibleColumns().length }} de {{ allColumns.length }})
  </div>
  <div class="collapse-content">
    <div class="flex flex-wrap gap-1.5 pt-1">
      <!-- existing column toggle buttons -->
    </div>
  </div>
</div>
```

This replaces the current divider + always-open buttons section.

---

## 4. Remove Membres / Xicalla Filter Buttons

In [person-list.component.html](apps/dashboard/src/app/features/persons/components/person-list.component.html), delete the "Membres" and "Xicalla" toggle buttons (lines 82-97). Keep only "Actius".

Also clean up `PersonFilterParams` references for `isMember` / `isXicalla` in the frontend model -- but keep them in the backend DTO since they might be used later.

---

## 5. Shoulder Height Relative Mode (+/- 140cm)

**New toggle** on the page: a switch/toggle that flips between "cm absoluts" and "relatiu (+/- 140)".

- [person-list.component.ts](apps/dashboard/src/app/features/persons/components/person-list.component.ts): Add `shoulderHeightRelative = signal(false)` and a computed `formatShoulderHeight(value: number | null): string` that applies the 140cm baseline if relative mode is on
- Template: In the filters area (near the column selector), add a small toggle:

```html
<label class="label cursor-pointer gap-2">
  <span class="label-text text-sm">Alçada relativa (+/- 140)</span>
  <input type="checkbox" class="toggle toggle-sm toggle-primary"
         [checked]="shoulderHeightRelative()"
         (change)="shoulderHeightRelative.set(!shoulderHeightRelative())" />
</label>
```

- In the table cell for `shoulderHeight`: show `+10` / `-5` / `0` with color coding (positive = green tint, negative = red tint, zero = neutral) when relative mode is on; raw cm value when off
- Update the column header label to reflect the current mode: "Alçada espatlles (cm)" vs "Alçada espatlles (+/-)"

---

## 6. UX / Style Improvements for Non-Expert Users

These are targeted polish items to make the page friendlier:

### a) Cleaner Filter Section

- Replace the 4-column grid layout with a simpler flex layout: search (wider, prominent), position dropdown, "Actius" toggle, and "Netejar filtres" -- all in one row that wraps naturally
- Make the search input larger/more prominent (it's the primary action)

### b) Better Visual Hierarchy

- Add a record count badge near the title: "Persones (143)" so users immediately see how many records exist
- Active filters should show as dismissible chips/badges above the table for discoverability

### c) Table Row Hover & Clickability

- Already has `hover cursor-pointer` -- add a subtle `transition-colors` and a tooltip or visual cue that rows are clickable (e.g., a small right-arrow on hover in the last cell)

### d) Pagination Improvements

- Show a "per page" selector (25 / 50 / 100) -- currently hardcoded to 50
- Move "Mostrant X - Y de Z" info closer to the pagination controls

### e) Empty / Loading States

- Add a skeleton loader instead of just a spinner for the loading state (more modern feel)

### f) Sticky Table Header

- Make `<thead>` sticky (`sticky top-0 z-10 bg-base-100`) so the column headers stay visible when scrolling vertically through many rows

---

## 7. Proposals Based on Data Analysis

Having reviewed the data model, here are additional improvements worth considering:

- **Quick stats bar**: Show a summary row above the table: "X actius / Y inactius / Z disponibles / W posicions" -- gives instant overview without filtering
- **Export CSV**: A button to download filtered results as CSV (useful for meetings/reports)
- **Keyboard shortcuts**: `Ctrl+K` or `/` to focus search instantly

These are optional/future -- flagging for your consideration. I will NOT implement them unless you say so.

---

## 8. Testing Strategy & Implementation

### Current Test Coverage

**Backend** ([person.service.spec.ts](apps/api/src/modules/person/person.service.spec.ts)):

- ✅ Basic CRUD operations (findOne, create, deactivate, activate)
- ✅ NotFoundException handling
- ✅ Position assignment
- ⚠️ **Missing**: Filter logic tests (search, positionIds, availability, isActive, etc.)
- ⚠️ **Missing**: Pagination edge cases
- ❌ **Missing**: Sorting logic (will be added with new feature)

**Frontend**:

- ❌ **No tests exist** for person-list.component
- ❌ **No tests exist** for person.service (Angular)
- ❌ **No tests exist** for utility functions (http-params.util, person.util)

### Test Implementation Plan

#### Backend Tests

**[person.service.spec.ts](apps/api/src/modules/person/person.service.spec.ts)** -- Expand existing suite:

1. **Sorting tests** (new feature):
  - Sort by allowed columns (alias, name, shoulderHeight, etc.) ASC/DESC
  - Default sort when no sortBy provided
  - Reject invalid column names (security)
  - Verify SQL injection protection
2. **Filter tests** (existing feature, missing coverage):
  - Search with accent-insensitive matching
  - Filter by positionIds (single, multiple, empty array)
  - Filter by availability, isActive, isXicalla, isMember
  - Combined filters (search + positions + isActive)
3. **Pagination tests**:
  - First page, last page, middle page
  - Edge cases: page beyond total, limit > total records

**[person-filter.dto.spec.ts](apps/api/src/modules/person/dto/person-filter.dto.spec.ts)** -- New file:

1. Validate `sortBy` against whitelist
2. Validate `sortOrder` enum ('ASC' | 'DESC')
3. Validate pagination params (min/max)
4. Type coercion tests (string -> number, string -> boolean)

**[person.controller.spec.ts](apps/api/src/modules/person/person.controller.spec.ts)** -- New file:

1. GET /persons with filters returns correct envelope `{ data, meta }`
2. Query params properly transformed to DTO
3. Error responses (404, 400)

#### Frontend Tests

**[person-list.component.spec.ts](apps/dashboard/src/app/features/persons/components/person-list.component.spec.ts)** -- New file:

1. **Component initialization**:
  - Loads persons on init
  - Loads positions on init
  - Restores visible columns from localStorage
2. **Search functionality**:
  - Debounced search (300ms)
  - Resets to page 1 on search
  - Calls API with search param
3. **Sorting** (new feature):
  - Click header toggles ASC -> DESC -> none
  - Calls API with sortBy/sortOrder
  - Visual indicators (arrows) update correctly
4. **Filters**:
  - Position multi-select adds/removes IDs
  - "Actius" toggle sets isActive filter
  - "Netejar filtres" clears all filters and search
5. **Column visibility**:
  - Toggle column adds/removes from visible list
  - Persists to localStorage
  - Collapsible starts closed (new feature)
6. **Shoulder height toggle** (new feature):
  - Toggle switches between cm and relative (+/-)
  - Formatting function applies 140cm baseline correctly
  - Color coding (positive = green, negative = red)
7. **Pagination**:
  - Previous/next buttons disabled at boundaries
  - Page number click navigates correctly
  - Per-page selector changes limit (new feature)
8. **Navigation**:
  - Row click navigates to detail page
  - Sync button navigates to sync page

**[person.service.spec.ts](apps/dashboard/src/app/features/persons/services/person.service.spec.ts)** -- New file:

1. `getAll()` calls correct endpoint with params
2. `getOne()` calls correct endpoint
3. `getPositions()` calls correct endpoint
4. HTTP error handling

**[http-params.util.spec.ts](apps/dashboard/src/app/core/utils/http-params.util.spec.ts)** -- New file:

1. Converts object to HttpParams
2. Handles arrays (appends multiple values)
3. Filters out undefined/null/empty string
4. Converts values to string

**[person.util.spec.ts](apps/dashboard/src/app/shared/utils/person.util.spec.ts)** -- New file:

1. `getFullName()` joins name parts correctly
2. `getAvailabilityLabel()` returns Catalan labels
3. `getOnboardingLabel()` returns Catalan labels
4. `formatShoulderHeight()` (new function):
  - Absolute mode returns "140 cm"
  - Relative mode returns "+10", "-5", "0"
  - Handles null values

### Test Execution

Run tests after implementation:

```bash
# Backend unit tests
nx test api

# Frontend unit tests
nx test dashboard

# Run all tests
nx run-many --target=test --all
```

### Coverage Goals

- Backend: ≥80% coverage for PersonService, PersonController
- Frontend: ≥70% coverage for person-list.component, person.service
- Utils: 100% coverage (small, pure functions)

---

## Files Modified


| Layer              | File                                                                                                              | Changes                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Backend DTO        | [person-filter.dto.ts](apps/api/src/modules/person/dto/person-filter.dto.ts)                                      | Add `sortBy`, `sortOrder`                                                             |
| Backend Service    | [person.service.ts](apps/api/src/modules/person/person.service.ts)                                                | Dynamic ORDER BY with whitelist                                                       |
| Backend Tests      | [person.service.spec.ts](apps/api/src/modules/person/person.service.spec.ts)                                      | Add sorting, filtering, pagination tests                                              |
| Backend Tests      | [person-filter.dto.spec.ts](apps/api/src/modules/person/dto/person-filter.dto.spec.ts)                            | **New file** - DTO validation tests                                                   |
| Backend Tests      | [person.controller.spec.ts](apps/api/src/modules/person/person.controller.spec.ts)                                | **New file** - Controller integration tests                                           |
| Frontend Model     | [person.model.ts](apps/dashboard/src/app/features/persons/models/person.model.ts)                                 | Add sort params to `PersonFilterParams`                                               |
| Frontend Component | [person-list.component.ts](apps/dashboard/src/app/features/persons/components/person-list.component.ts)           | Sort signals, shoulder height toggle, remove unused filter methods, per-page selector |
| Frontend Template  | [person-list.component.html](apps/dashboard/src/app/features/persons/components/person-list.component.html)       | Major restructure: sortable headers, remove card view, collapsible columns, UX polish |
| Frontend Styles    | [person-list.component.scss](apps/dashboard/src/app/features/persons/components/person-list.component.scss)       | Sticky header, sticky first column styles                                             |
| Frontend Tests     | [person-list.component.spec.ts](apps/dashboard/src/app/features/persons/components/person-list.component.spec.ts) | **New file** - Component unit tests                                                   |
| Frontend Tests     | [person.service.spec.ts](apps/dashboard/src/app/features/persons/services/person.service.spec.ts)                 | **New file** - Service unit tests                                                     |
| Frontend Tests     | [http-params.util.spec.ts](apps/dashboard/src/app/core/utils/http-params.util.spec.ts)                            | **New file** - Utility tests                                                          |
| Frontend Tests     | [person.util.spec.ts](apps/dashboard/src/app/shared/utils/person.util.spec.ts)                                    | **New file** - Utility tests                                                          |
| HTTP Params        | [http-params.util.ts](apps/dashboard/src/app/core/utils/http-params.util.ts)                                      | No changes needed (already handles string params)                                     |


