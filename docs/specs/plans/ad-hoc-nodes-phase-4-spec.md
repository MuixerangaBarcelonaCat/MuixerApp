# Ad-Hoc Instance Nodes — Phase 4 Specification

> **Status:** Draft
> **Created:** 2026-06-11
> **Parent spec:** [`docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md`](../2026-06-10-ad-hoc-instance-nodes-design.md)
> **Phase 3 spec:** [`docs/specs/plans/ad-hoc-nodes-phase-3-spec.md`](ad-hoc-nodes-phase-3-spec.md)
> **Branch:** `feat/ad-hoc-nodes-phase-4`
> **Scope:** Template editor awareness, help modal enhancement, node duplication, keyboard shortcuts, Phase 3 fixes
> **DB migration:** None required

---

## 1. Executive Summary

Phase 4 focuses on **UX polish and discoverability**: richer help content, keyboard shortcuts for power users, node duplication, an informational banner in the template editor, and fixing outstanding Phase 3 gaps (commented-out alert, missing tests, spec status).

No database migration. Primarily frontend work with one small backend query addition.

---

## 2. What Phases 1–3 Already Provide

| Item | Phase |
|------|-------|
| Ad-hoc CRUD (POST/PATCH/DELETE) + auto-snapshot | 1 |
| Placement mode, dashed border, drag/resize/rotate | 1 |
| Bulk import clones ad-hoc nodes | 1 |
| Help modal with basic content | 1 |
| DECORATION zone (non-assignable) + ARROW/CIRCLE shapes | 2 |
| Properties panel (label, shape, color, dimensions) | 2 |
| Split FAB (Pinya, Decoratiu, Direccions) | 3 |
| Direction nodes (FIGURE_DIRECTION, XICALLA_DIRECTION) | 3 |
| Swap fix (delete+recreate in transaction) | 3 |
| Decoration assignment frontend guard | 3 |

---

## 3. Phase 4 Scope — What Changes

### 3.1 Phase 3 Fixes

Three items that should have shipped with Phase 3:

**A. Uncomment direction info alert**

In `ad-hoc-node-properties.component.html` (lines 31–35), the direction person-uniqueness alert is commented out:

```html
<!-- @if (isDirection()) {
  <div class="alert alert-info py-1.5 px-2 text-xs">
    <span>La mateixa persona no pot repetir-se al segment (entre totes les instàncies).</span>
  </div>
} -->
```

Uncomment and verify it renders when a direction ad-hoc node is selected.

**B. Missing frontend tests for Phase 3 direction presets**

`assignment-canvas.component.spec.ts` has Phase 2 DECORATION tests but no Phase 3 direction coverage. Add:

- Direction FAB button renders when not locked
- Direction preset enters placement mode directly (no label dialog)
- Direction node creation via canvas click
- Direction node is assignable (unlike DECORATION)

**C. Phase 2 spec status update**

`ad-hoc-nodes-phase-2-spec.md` header says `Status: Draft` but parent spec marks Phase 2 as Implemented. Update to `Status: Implemented`.

### 3.2 Help Modal Enhancement

Rewrite `ad-hoc-nodes-help-modal.component.html` to be a comprehensive user guide. Source of truth: `docs/internal/ad-hoc-nodes-user-guide.md`.

**New sections to add:**

1. **"Dreceres de teclat"** — table with all shortcuts:

| Tecla | Acció |
|-------|-------|
| Clic | Seleccionar node (per assignar) |
| Arrossegar | Moure node ad-hoc |
| Doble clic | Mode redimensió/rotació |
| Escape | Cancel·lar acció / sortir de mode |
| Suprimir / Backspace | Eliminar node ad-hoc seleccionat |
| Tab | Avançar al següent node buit |
| Ctrl+D | Duplicar node ad-hoc seleccionat |
| Ctrl+1..9 | Crear node de pinya ràpidament |

2. **"Diferències amb els nodes del template"** — comparison table:

| Característica | Nodes del template | Nodes ad-hoc |
|---|---|---|
| Origen | Copiats del template | Creats manualment |
| Aparença | Vora contínua | Vora discontínua |
| Moviment | Fixos | Lliures |
| Redimensió | No | Sí (doble clic) |
| Eliminació | No | Sí (Suprimir) |
| Import | Per posició/rengla | Íntegrament amb assignacions |
| Template | No afecten | Cap relació |

3. **"Coses importants"** — warnings section:
   - Reset esborra TOT (template + ad-hoc)
   - El bloqueig s'aplica
   - L'import copia els ad-hoc
   - Canvis al template no afecten

4. **Comodin explanation** — clarify that "Comodí" allows a custom label for non-standard positions.

5. **Keyboard shortcut hints** — Ctrl+1..9 mapping after §3.5 is implemented.

### 3.3 Template Editor Informational Banner

**Goal:** Alert template editors that snapshotted instances with ad-hoc nodes exist, and template changes won't affect them.

**Backend:**

Extend `findOne()` in `figure-template.service.ts` to include `adHocInstanceCount`:

```typescript
async findOne(id: string): Promise<FigureTemplateDetailItem> {
  const template = await this.templateRepository.findOne({
    where: { id },
    relations: ['nodes', 'rengles'],
  });
  if (!template) throw new NotFoundException(...);

  const adHocInstanceCount = await this.instanceNodeRepository
    .createQueryBuilder('in')
    .innerJoin('in.figureInstance', 'fi')
    .where('fi.figureTemplateId = :templateId', { templateId: id })
    .andWhere('fi.snapshotted = true')
    .andWhere('in.isAdHoc = true')
    .select('COUNT(DISTINCT fi.id)', 'count')
    .getRawOne()
    .then(r => parseInt(r?.count ?? '0', 10));

  return { ...toDetailItem(template), adHocInstanceCount };
}
```

Requires injecting `InstanceNodeRepository` (or using `DataSource.getRepository()`) into `FigureTemplateService`.

**Shared interface:**

Add to `FigureTemplateDetailItem` in `libs/shared/src/interfaces/pinyes/figure.interfaces.ts`:

```typescript
adHocInstanceCount?: number;
```

Optional to avoid breaking the list endpoint response.

**Frontend:**

In `template-editor.component.html`, after the header toolbar, add a dismissible banner:

```html
@if (adHocInstanceCount() > 0) {
  <div class="alert alert-info text-sm mx-4 mt-2" role="status">
    <i-lucide [img]="Info" class="size-4 shrink-0" />
    <span>
      Hi ha {{ adHocInstanceCount() }}
      {{ adHocInstanceCount() === 1 ? 'instància' : 'instàncies' }}
      amb nodes creats manualment. Els canvis al template no afecten les instàncies ja existents.
    </span>
    <button type="button" class="btn btn-ghost btn-xs" (click)="dismissAdHocBanner()" aria-label="Tancar">
      <i-lucide [img]="X" class="size-3" />
    </button>
  </div>
}
```

New signal in `template-editor.component.ts`:

```typescript
readonly adHocInstanceCount = signal(0);
readonly adHocBannerDismissed = signal(false);
```

Set from `loadTemplate()` response.

### 3.4 Node Duplication (Clone)

**Goal:** Ctrl+D duplicates the selected ad-hoc node with offset positioning.

**Interaction:**
- Select any ad-hoc node → Ctrl+D (or Cmd+D on macOS)
- Creates a copy at (+20, +20) offset from original
- Copies: zone, positionType, shape, width, height, rotation, color
- Label: original label + " (còpia)"
- Assignment is NOT copied (new node starts unassigned)

**Implementation in `assignment-canvas.component.ts`:**

Add to `onKeyDown()`:

```typescript
if (event.key === 'd' && (event.ctrlKey || event.metaKey) && !this.isLocked()) {
  event.preventDefault();
  const node = this.selectedAdHocNode();
  if (!node) return;
  this.duplicateAdHocNode(node);
  return;
}
```

New method:

```typescript
private duplicateAdHocNode(node: InstanceNodeItem): void {
  const instanceId = this.state.activeInstanceId();
  if (!instanceId) return;

  this.assignmentService
    .createAdHocNode(instanceId, {
      zone: node.zone as FigureZone,
      positionType: node.positionType ?? undefined,
      label: `${node.label} (còpia)`,
      x: node.x + 20,
      y: node.y + 20,
      width: node.width,
      height: node.height,
      shape: node.shape as NodeShape,
      color: node.color ?? undefined,
      rotation: node.rotation,
    })
    .subscribe({
      next: () => {
        this.refreshInstanceNodes(instanceId);
        this.toast.success(`Node "${node.label}" duplicat.`);
      },
      error: () => this.toast.error('Error en duplicar el node.'),
    });
}
```

No new backend endpoint — reuses existing `POST /figure-instances/:id/ad-hoc-nodes`.

### 3.5 Keyboard Shortcuts for Quick Creation

**Goal:** Ctrl+1..9 enters placement mode for pinya presets without opening the FAB menu.

**Mapping (matches `AD_HOC_PINYA_PRESETS` index order):**

| Shortcut | Preset | Notes |
|----------|--------|-------|
| Ctrl+1 | Agulla | Direct placement |
| Ctrl+2 | Mans | Direct placement |
| Ctrl+3 | Laterals | Direct placement |
| Ctrl+4 | Vents | Direct placement |
| Ctrl+5 | Cordó obert | Direct placement |
| Ctrl+6 | Tap | Direct placement |
| Ctrl+7 | Crossa | Direct placement |
| Ctrl+8 | Contrafort | Direct placement |
| Ctrl+9 | Comodí | Opens label dialog first |

**Guards — shortcut only fires when ALL conditions are met:**
- Not locked
- Active tab exists (an instance is selected)
- Not already in placement mode
- No modal open (`!helpModalOpen() && !comodinInputOpen() && !deleteAdHocModalOpen()`)
- Not editing an input field (existing `isEditing` check in `onKeyDown`)

**Implementation in `onKeyDown()`:**

```typescript
if (event.ctrlKey || event.metaKey) {
  const digit = parseInt(event.key, 10);
  if (digit >= 1 && digit <= 9 && !this.isLocked() && this.activeTab()
      && !this.state.isPlacementMode()
      && !this.helpModalOpen() && !this.comodinInputOpen()) {
    event.preventDefault();
    const preset = this.adHocPresets[digit - 1];
    if (preset) this.onPresetSelected(preset);
    return;
  }
}
```

This reuses `onPresetSelected()`, which already handles the `requiresCustomLabel` check for comodin (index 8 → Ctrl+9).

---

## 4. Edge Cases

| Scenario | Behavior |
|----------|----------|
| Ctrl+D with no selection | Nothing happens |
| Ctrl+D on a template (non-ad-hoc) node | Nothing happens (`selectedAdHocNode()` is null) |
| Ctrl+D on locked event | Nothing happens (lock guard) |
| Ctrl+D duplicates a DECORATION node | New DECORATION created at offset, no assignment |
| Ctrl+1 on locked event | Nothing happens |
| Ctrl+1 while in placement mode | Nothing happens (guard) |
| Ctrl+9 (comodin) | Opens label dialog, then placement mode |
| Ctrl+1 while editing input | Nothing happens (`isEditing` check) |
| Template with 0 ad-hoc instances | No banner shown |
| Template with 3 ad-hoc instances | Banner: "Hi ha 3 instàncies amb nodes creats manualment." |
| Dismiss banner → reload page | Banner reappears (session-only dismiss) |
| Direction node selected → properties panel | Info alert visible (uncommented) |

---

## 5. Invariants

1. **No behavioral changes to existing features** — Phases 1–3 behavior unchanged.
2. **No DB migration** — all changes are application-level.
3. **Keyboard shortcuts respect guards** — locked, modal, editing state all block shortcuts.
4. **Duplication is geometry-only** — assignments never copied.
5. **Template editor banner is informational** — no blocking, dismissible, no write operations.

---

## 6. Manual Testing Checklist — Phase 4

### P4.1 — Phase 3 Fixes

| # | Test | Expected |
|---|------|----------|
| P4.1.1 | Select a direction ad-hoc node (FIGURE_DIRECTION) | Properties panel shows info alert about person uniqueness |
| P4.1.2 | Select a PINYA ad-hoc node | No info alert shown |
| P4.1.3 | Select a DECORATION ad-hoc node | No info alert shown (decoration section shows instead) |

### P4.2 — Help Modal

| # | Test | Expected |
|---|------|----------|
| P4.2.1 | Click "?" help button | Modal opens with full guide |
| P4.2.2 | Check "Dreceres de teclat" section | Table with all shortcuts present |
| P4.2.3 | Check "Diferències" section | Comparison table present |
| P4.2.4 | Check "Coses importants" section | Reset/lock/import warnings present |
| P4.2.5 | Press Escape | Modal closes |
| P4.2.6 | Click "Entès" | Modal closes |
| P4.2.7 | Focus trap active | Tab cycles within modal |

### P4.3 — Template Editor Banner

| # | Test | Expected |
|---|------|----------|
| P4.3.1 | Open template editor for template with ad-hoc instances | Info banner visible with correct count |
| P4.3.2 | Open template editor for template with NO ad-hoc instances | No banner |
| P4.3.3 | Open template editor for NEW template (no ID) | No banner |
| P4.3.4 | Click dismiss button on banner | Banner disappears |
| P4.3.5 | Reload page after dismiss | Banner reappears (session-only) |

### P4.4 — Node Duplication

| # | Test | Expected |
|---|------|----------|
| P4.4.1 | Select PINYA ad-hoc → Ctrl+D | Duplicate appears at (+20,+20) with label + " (còpia)" |
| P4.4.2 | Select DECORATION ad-hoc → Ctrl+D | Duplicate DECORATION created (no assignment) |
| P4.4.3 | Select direction ad-hoc → Ctrl+D | Duplicate direction created |
| P4.4.4 | No selection → Ctrl+D | Nothing happens |
| P4.4.5 | Template node selected → Ctrl+D | Nothing happens |
| P4.4.6 | Locked event → Ctrl+D | Nothing happens |
| P4.4.7 | Duplicate preserves shape/color/size/rotation | Verify visually |
| P4.4.8 | Duplicate is unassigned | No person badge on clone |
| P4.4.9 | Cmd+D on macOS | Same behavior as Ctrl+D |

### P4.5 — Keyboard Shortcuts

| # | Test | Expected |
|---|------|----------|
| P4.5.1 | Ctrl+1 (not locked, active tab) | Enters placement mode for Agulla |
| P4.5.2 | Click canvas in placement mode | Agulla node created |
| P4.5.3 | Ctrl+5 | Placement mode for Cordó obert |
| P4.5.4 | Ctrl+9 | Label dialog opens for Comodí |
| P4.5.5 | Type label → Enter → click canvas | Comodí created with label |
| P4.5.6 | Ctrl+1 while locked | Nothing happens |
| P4.5.7 | Ctrl+1 while in placement mode | Nothing happens |
| P4.5.8 | Ctrl+1 while help modal open | Nothing happens |
| P4.5.9 | Ctrl+1 while typing in input field | Nothing happens (isEditing guard) |
| P4.5.10 | Ctrl+1..8 → verify correct preset matches | Each shortcut matches correct position type |
| P4.5.11 | Cmd+1..9 on macOS | Same behavior as Ctrl+1..9 |

### P4.6 — Regression

| # | Test | Expected |
|---|------|----------|
| P4.6.1 | FAB menus still work | All 3 FAB buttons open correct dropdowns |
| P4.6.2 | Existing keyboard shortcuts | Escape, Tab, Delete, Arrow keys unchanged |
| P4.6.3 | Placement mode flow | Unchanged from Phase 1 |
| P4.6.4 | Properties panel editing | Debounced PATCH still works |
| P4.6.5 | Swap assignment | No duplicate key errors |
| P4.6.6 | Bulk import with ad-hoc | Clones correctly |

---

## 7. File Changes Summary

| File | Change |
|------|--------|
| `apps/dashboard/.../ad-hoc-node-properties/ad-hoc-node-properties.component.html` | Uncomment direction info alert |
| `apps/dashboard/.../ad-hoc-nodes-help-modal/ad-hoc-nodes-help-modal.component.html` | Rewrite with full guide content |
| `apps/dashboard/.../assignment-canvas/assignment-canvas.component.ts` | Add Ctrl+D duplication, Ctrl+1..9 shortcuts |
| `apps/dashboard/.../assignment-canvas/assignment-canvas.component.spec.ts` | Phase 3 direction tests + Phase 4 shortcut/duplication tests |
| `apps/dashboard/.../template-editor/template-editor.component.ts` | `adHocInstanceCount` signal, banner dismiss |
| `apps/dashboard/.../template-editor/template-editor.component.html` | Informational banner |
| `apps/api/src/modules/figure/figure-template.service.ts` | Count ad-hoc instances in `findOne()` |
| `libs/shared/src/interfaces/pinyes/figure.interfaces.ts` | `adHocInstanceCount` field |
| `docs/specs/plans/ad-hoc-nodes-phase-2-spec.md` | Status: Draft → Implemented |
| `docs/specs/2026-06-10-ad-hoc-instance-nodes-design.md` | Phase 4/5 references in §10 and §13 |

---

## 8. Definition of Done

- [ ] Direction info alert visible when direction node selected in properties panel
- [ ] Help modal includes keyboard shortcuts, differences table, and important notes
- [ ] Template editor shows informational banner when ad-hoc instances exist
- [ ] Ctrl+D duplicates selected ad-hoc node with offset and "(còpia)" suffix
- [ ] Ctrl+1..9 creates pinya presets via keyboard (Ctrl+9 opens label dialog)
- [ ] All guards respected (locked, modal, editing, placement mode)
- [ ] Frontend unit tests cover direction presets + duplication + shortcuts
- [ ] No lint errors introduced
- [ ] Phase 1 + Phase 2 + Phase 3 behavior unchanged
- [ ] Phase 2 spec status updated to Implemented
