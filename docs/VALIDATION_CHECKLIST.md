# Validation Checklist - Vertical Slice Completion

Based on section 12 of `docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`.

## Pre-Validation Setup

- [ ] Ensure `.env` file has correct `LEGACY_API_URL`, `LEGACY_API_USERNAME`, `LEGACY_API_PASSWORD`
- [ ] Start API: `nx serve api` (or `nx run api:no-watch`)
- [ ] Start Dashboard: `nx serve dashboard`
- [ ] Verify API is running at `http://localhost:3000`
- [ ] Verify Dashboard is running at `http://localhost:4200`
- [ ] Open browser DevTools (Network + Console tabs)

## Backend Validation

### 1. API Health Check
- [ ] Open `http://localhost:3000/api/docs` (Swagger UI)
- [ ] Verify all endpoints are documented
- [ ] Verify `GET /api/sync/persons` endpoint exists in Swagger

### 2. Sync Endpoint (Manual Test via curl or Swagger)
- [ ] Test `GET /api/sync/persons` via curl:
  ```bash
  curl -N http://localhost:3000/api/sync/persons
  ```
- [ ] Verify SSE events stream (start, progress, complete)
- [ ] Check terminal logs for sync activity
- [ ] Verify no errors in API logs

### 3. Person API Responses
- [ ] `GET /api/persons` - verify `legacyId` is NOT in response
- [ ] `GET /api/persons/{id}` - verify `legacyId` is NOT in response
- [ ] Verify response includes `positions` array with color/zone
- [ ] Verify pagination metadata (`total`, `page`, `limit`)

### 4. Database Verification (via Swagger or DB client)
- [ ] After first sync: verify persons exist in database
- [ ] Verify positions were created with correct slugs/colors
- [ ] Verify `legacyId` column exists in `person` table (internal only)
- [ ] Run sync again: verify idempotency (no duplicates, updates work)

### 5. Sync Logic Validation
- [ ] **CREATE path**: New person has positions, notes, isXicalla derived
- [ ] **UPDATE path**: Existing person updated (name, email, etc.) but positions/notes/isXicalla unchanged
- [ ] Verify position mapping (PRIMERES → primeres, VENTS → vents, etc.)
- [ ] Verify `isMember` derived from `propi` field
- [ ] Verify `availability` derived from `lesionat` field

## Frontend Validation

### 6. Dashboard Layout
- [ ] Desktop (>= 1024px): Sidebar visible, header visible, main content area
- [ ] Tablet (768px): Sidebar visible, responsive layout
- [ ] Mobile (375px): Sidebar hidden, hamburger menu visible in header
- [ ] Click hamburger: DaisyUI drawer opens with sidebar content
- [ ] Click sidebar link in mobile: Drawer closes automatically

### 7. Person List Component
- [ ] Desktop: Table renders with columns (Alies, Nom complet, Posicions, Disponibilitat, Actiu)
- [ ] Mobile: Cards render with same data
- [ ] Position badges: correct colors, readable contrast
- [ ] Search: type in search box, wait 300ms, list updates
- [ ] Position filter: select position, list filters
- [ ] Toggle filters: Actius, Membres, Xicalla work correctly
- [ ] Clear filters: resets all filters
- [ ] Pagination: navigate pages, verify counts

### 8. Person Detail Component
- [ ] Click person in list: navigate to detail view
- [ ] Desktop: 2-column grid layout
- [ ] Mobile: single-column stacked layout
- [ ] All fields render correctly (name, email, phone, birthDate, etc.)
- [ ] Position badges: correct colors
- [ ] Metadata footer: click to expand/collapse
- [ ] Verify `legacyId` is NOT shown anywhere
- [ ] Back button: returns to list

### 9. Person Sync Component
- [ ] Click "Sincronitzar" button in list: navigate to sync page
- [ ] Initial state: "Preparat" badge, "Iniciar sincronització" button
- [ ] Click "Iniciar sincronització": state changes to "En procés..."
- [ ] Progress bar: updates as persons are processed
- [ ] Log panel: events appear in real-time, auto-scrolls to bottom
- [ ] Event colors: start (blue), progress (green), error (red), complete (green)
- [ ] Cancel button: stops sync, shows cancellation message
- [ ] On complete: summary shows (Noves, Actualitzades, Errors)
- [ ] "Veure persones actualitzades" button: returns to list and reloads

### 10. Responsive Breakpoints
- [ ] Test at 375px (mobile): cards, hamburger menu, single-column detail
- [ ] Test at 768px (tablet): table appears, sidebar visible
- [ ] Test at 1024px (desktop): full layout, 2-column detail grid

## Integration Validation

### 11. End-to-End Flow (First Sync)
- [ ] Start with empty database
- [ ] Navigate to `/persons/sync`
- [ ] Run sync: verify all persons imported
- [ ] Navigate to `/persons`: verify list populated
- [ ] Click person: verify detail view
- [ ] Back to list: verify navigation

### 12. End-to-End Flow (Re-Sync)
- [ ] Manually edit a person's email via Swagger (`PATCH /api/persons/{id}`)
- [ ] Run sync again
- [ ] Verify email is NOT overwritten (update path preserves local changes to notes/positions)
- [ ] Verify personal fields (name, phone, etc.) ARE updated from legacy

### 13. Error Handling
- [ ] Stop API server: verify dashboard shows connection error in sync
- [ ] Invalid legacy credentials: verify sync shows authentication error
- [ ] Network timeout: verify graceful error handling

### 14. Browser Compatibility
- [ ] Chrome: all features work
- [ ] Firefox: all features work
- [ ] Safari: all features work
- [ ] Mobile Safari (iOS): responsive layout, touch interactions

## Performance Validation

### 15. Load Time
- [ ] Dashboard initial load: < 2 seconds
- [ ] Person list with 100+ persons: renders smoothly
- [ ] Sync with 100+ persons: completes within reasonable time (< 2 minutes)

### 16. Network Efficiency
- [ ] Check Network tab: no unnecessary requests
- [ ] SSE connection: single persistent connection, no polling
- [ ] Pagination: only fetches current page data

## Code Quality Validation

### 17. Linting and Tests
- [ ] Run `nx lint api`: no errors
- [ ] Run `nx lint dashboard`: no errors
- [ ] Run `nx test api`: all tests pass (including new sync tests)
- [ ] Run `nx build api`: builds successfully
- [ ] Run `nx build dashboard`: builds successfully

### 18. TypeScript Strictness
- [ ] No `any` types in new code
- [ ] All interfaces/DTOs properly typed
- [ ] No TypeScript errors in IDE

## Documentation Validation

### 19. Spec Compliance
- [ ] Re-read spec section 3 (Backend Sync): verify implementation matches
- [ ] Re-read spec section 4 (Frontend Models): verify interfaces match
- [ ] Re-read spec section 7 (Dashboard UI): verify components match

### 20. README and Docs
- [ ] `README.md`: instructions are up-to-date
- [ ] `docs/NEXT_STEPS.md`: reflects current state
- [ ] `docs/PROJECT_ROADMAP.md`: P0-P2 marked as complete

## Post-Validation Actions

- [ ] Document any field mapping adjustments needed
- [ ] Create issues for any bugs found
- [ ] Update spec if implementation deviated (with justification)
- [ ] Commit all changes with descriptive message
- [ ] Push to remote branch

## Notes

Use this space to document findings, issues, or observations during validation:

```
[Add notes here]
```
