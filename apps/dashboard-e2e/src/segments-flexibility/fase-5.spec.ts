import { test, expect } from '@playwright/test';
import { loginViaUi } from '../audit/login-helper';
import { spaGoto } from '../audit/audit-core';
import { TARGETS } from '../audit/audit-targets';

/**
 * Phase 5 — "El canvi de règim" — duplicate placements are now a real, UI-reachable state
 * once `1783800000000-DropNodeAssignmentDuplicateUniques` has run against the dev DB (done as
 * part of writing this spec: `nx run api:migration-run`, confirmed via `\d node_assignments`).
 *
 * Full loop against real dev data (no mocks): free a TRONC node → assign an already-placed
 * person there via the D8 "Persona ja assignada" dialog's "Assignar igualment" action → the
 * canonical conflict banner appears → resolve it from the panel ("Treu esta") → reassign the
 * original occupant back → banner clears. The last two steps restore the segment to its
 * original state so the test is repeatable and leaves dev data untouched.
 *
 * Every assertion is an explicit `expect(...).toHaveCount(...)`/`toBeVisible()` — never gated
 * behind `if (await x.count())` (see fase-4.spec.ts for why).
 *
 * Requires the dashboard + API dev servers up and E2E_EMAIL / E2E_PASSWORD set.
 */

const EVENT_ID = TARGETS.workspaceEventId;
const SEGMENT_ID = TARGETS.workspaceSegmentId;

// "Pinet doble" #2 (figureInstanceId e7997cbc-...), TRONC "segones" node — occupied by IVÁN in
// the reference dev dataset. Verified live against the dev DB while writing this spec.
const TARGET_NODE_ID = 'a7191c81-b72d-405b-a43c-2d8fa5793256';
const ORIGINAL_OCCUPANT_SEARCH = 'IVAN';
const DUPLICATE_SOURCE_SEARCH = 'TERESA';

test.describe('Segments flexibility · Phase 5 (duplicate placement lifecycle)', () => {
  test('assign duplicate via "Assignar igualment" → conflict banner → resolve from panel → restore', async ({
    page,
  }, testInfo) => {
    const consoleErrors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await loginViaUi(page);
    await spaGoto(page, `/pinyes/events/${EVENT_ID}/segments/${SEGMENT_ID}/assign`);
    await page.getByRole('tab', { name: /troncs/i }).click();

    const targetNode = page.locator(`[data-tronc-node-id="${TARGET_NODE_ID}"]`);
    await expect(targetNode).toBeVisible({ timeout: 15000 });
    await expect(targetNode).toHaveClass(/assigned/);

    const banner = page.getByText(/person(a|es) en conflicte/);
    const searchInput = page.getByLabel('Cerca persones');

    // Zero conflicts at the start — this dev dataset was restored to a clean state by a
    // previous run of this same spec (or has never had a duplicate created in it).
    await expect(banner).toHaveCount(0);

    // 1. Free the target TRONC node (select it, then Backspace in the empty search box —
    //    the panel's keyboard-driven unassign, see person-panel.component.ts:472).
    await targetNode.click();
    await searchInput.click();
    await page.keyboard.press('Backspace');
    await expect(targetNode).not.toHaveClass(/assigned/);

    // 2. Re-select the now-free node as the assignment target.
    await targetNode.click();
    await expect(targetNode).toHaveClass(/selected/);

    // 3. Search for a person already assigned elsewhere in this segment and pick them —
    //    triggers the "Persona ja assignada" dialog (D8).
    await searchInput.fill(DUPLICATE_SOURCE_SEARCH);
    const duplicateOption = page.getByRole('option').filter({ hasText: DUPLICATE_SOURCE_SEARCH });
    await expect(duplicateOption).toHaveCount(1);
    await duplicateOption.first().click();

    const dialog = page.getByRole('dialog', { name: 'Persona ja assignada' });
    await expect(dialog).toBeVisible();
    const assignAnywayButton = dialog.getByRole('button', { name: 'Assignar igualment' });
    await expect(assignAnywayButton).toBeVisible();

    await page.screenshot({
      path: testInfo.outputPath('phase5-already-assigned-dialog.png'),
      fullPage: true,
    });

    // 4. Confirm the deliberate-friction action (D8) — this is what Phase 5 makes actually
    //    succeed instead of the backend rejecting it with a 409.
    await assignAnywayButton.click();
    await expect(dialog).toHaveCount(0);

    // 5. The canonical conflict banner appears (Fase 4 mechanism, now reachable for real).
    await expect(banner).toHaveCount(1);
    await expect(banner).toContainText('1 persona en conflicte');

    await page.screenshot({
      path: testInfo.outputPath('phase5-conflict-banner.png'),
      fullPage: true,
    });

    // 6. Resolve from the conflict panel: expand it and remove one of the two placements.
    await page.getByRole('button', { name: 'Mostra', exact: true }).click();
    const removeButtons = page.getByRole('button', { name: 'Treu esta' });
    await expect(removeButtons).toHaveCount(2);
    await removeButtons.nth(1).click();

    // Conflict resolved — banner clears, target node is free again.
    await expect(banner).toHaveCount(0);
    await expect(targetNode).not.toHaveClass(/assigned/);

    // 7. Restore the segment: reassign the original occupant to the freed node.
    await targetNode.click();
    await searchInput.fill(ORIGINAL_OCCUPANT_SEARCH);
    const originalOption = page.getByRole('option').filter({ hasText: /IV.N/i });
    await expect(originalOption.first()).toBeVisible();
    await originalOption.first().click();

    await expect(targetNode).toHaveClass(/assigned/);
    await expect(banner).toHaveCount(0);

    await page.screenshot({
      path: testInfo.outputPath('phase5-restored.png'),
      fullPage: true,
    });

    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
