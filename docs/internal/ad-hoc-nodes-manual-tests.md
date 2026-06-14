# Ad-Hoc Instance Nodes — Phase 1: Manual Test Checklist

**Date:** 2026-06-11
**Branch:** `feat/assignar-nodes-nous`
**Test URL:** `http://localhost:4200/pinyes/events/{eventId}/segments/{segmentId}/assign`

---

## File Change Reference

Each test group below references the files responsible. If a test fails, start debugging from these files.

### Backend (API)

| File | What changed |
|---|---|
| `apps/api/src/modules/node-assignment/node-assignment.controller.ts` | CRUD endpoints: `POST/PATCH/DELETE /figure-instances/:id/ad-hoc-nodes/:nodeId` |
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | `createAdHocNode` (atomic transaction), `updateAdHocNode`, `deleteAdHocNode`, `bulkImport` (idempotency for ad-hoc cloning) |
| `apps/api/src/modules/node-assignment/dto/create-ad-hoc-node.dto.ts` | Validation: `label` trim + `@IsNotEmpty`, `positionType`, `x`, `y` |
| `apps/api/src/modules/node-assignment/dto/update-ad-hoc-node.dto.ts` | Validation: `label` trim + `@MinLength(1)`, `shape`, `width`, `height`, `rotation`, `color`, `x`, `y` |
| `apps/api/src/modules/event-segment/entities/instance-node.entity.ts` | `isAdHoc`, `createdById`, `originNodeId` columns |
| `apps/api/src/migrations/1781200000000-AddAdHocInstanceNodes.ts` | DB migration: adds columns to `instance_nodes` |
| `libs/shared/src/constants/ad-hoc-node.constants.ts` | Presets: LATERALS, VENTS, CORDO_OBERT, TAP, CROSSA, CONTRAFORT |

### Frontend — Assignment Canvas

| File | What changed |
|---|---|
| `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.ts` | FAB dropdown signal, placement mode, keyboard handlers (ESC/Delete/Backspace/Arrows/Tab), `onCanvasClicked` ad-hoc creation, `moveAdHocNodeByKey`, `onAdHocNodeMoved/Transformed/Updated/DeleteFromPanel`, `selectedAdHocNode` computed |
| `apps/dashboard/src/app/features/pinyes/components/assignment-canvas/assignment-canvas.component.html` | FAB menu (removed DaisyUI `dropdown`, uses manual absolute positioning), placement banner, delete modal, properties panel integration, help modal component |

### Frontend — Figure Canvas (Konva)

| File | What changed |
|---|---|
| `apps/dashboard/src/app/features/pinyes/components/figure-canvas/figure-canvas.component.ts` | Ad-hoc node rendering: dashed borders, `draggable: true`, `click tap` handler for single-click selection, `dragend` for movement, `dblclick` selects + shows transformer, `adHocNodeMoved`/`adHocNodeTransformed` outputs, crosshair cursor in placement mode, Konva Tooltip, `updateTransformer()` now supports ad-hoc in assignment mode |

### Frontend — Properties Panel & Help Modal

| File | What changed |
|---|---|
| `apps/dashboard/src/app/features/pinyes/components/ad-hoc-node-properties/ad-hoc-node-properties.component.ts` | Floating panel: label, shape, width, height, rotation, x, y, color editing with debounced API calls |
| `apps/dashboard/src/app/features/pinyes/components/ad-hoc-node-properties/ad-hoc-node-properties.component.html` | Form UI, positioned `top-12 left-4`, `max-h-[calc(100%-6rem)]` to avoid overflow clipping |
| `apps/dashboard/src/app/features/pinyes/components/ad-hoc-nodes-help-modal/ad-hoc-nodes-help-modal.component.ts` | Standalone modal with keyboard shortcuts reference |

### Frontend — Services & State

| File | What changed |
|---|---|
| `apps/dashboard/src/app/features/pinyes/services/assignment-state.service.ts` | `isPlacementMode`, `placementPreset`, `placementCustomLabel`, `activeTabNodes`, `adHocNodes`, `hasAdHocNodes` signals |
| `apps/dashboard/src/app/features/pinyes/services/node-assignment.service.ts` | `createAdHocNode`, `updateAdHocNode`, `deleteAdHocNode` HTTP methods |
| `apps/dashboard/src/app/features/pinyes/models/assignment.model.ts` | `UpdateAdHocNodePayload` interface |
| `apps/dashboard/src/app/core/services/layout.service.ts` | Removed global ESC listener (was intercepting component-level ESC handling) |

---

## Test Groups

### T1 — FAB Dropdown & Node Creation

> **Files:** `assignment-canvas.component.html` (lines 162-211), `assignment-canvas.component.ts` (`fabDropdownOpen`, `onPresetSelected`, `onCanvasClicked`), `node-assignment.service.ts` (`createAdHocNode`)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T1.1 | Click the blue `+` FAB (bottom-right of canvas) | Dropdown menu appears above the button with 7 presets: Laterals, Vents, Cordó obert, Tap, Crossa, Contrafort, Comodí | |
| T1.2 | Click "Laterals" preset from the dropdown | Banner appears: "Mode col·locació: fes clic al canvas per situar el node." Cursor changes to crosshair. | |
| T1.3 | Click on the canvas while in placement mode | New ad-hoc node appears at the clicked position with label "Laterals", dashed border, correct color. Placement mode exits. | |
| T1.4 | Select "Comodí (etiqueta lliure)" from FAB dropdown | A text input appears to enter a custom label | |
| T1.5 | Enter custom label and confirm → click canvas | Ad-hoc node appears with the custom label | |
| T1.6 | Click FAB → then click ESC before clicking canvas | Placement mode cancels, cursor returns to default | |
| T1.7 | Click FAB → click on the canvas (empty area, not a node) | Node is created at the click position | |
| T1.8 | Click outside the dropdown menu (e.g., on the canvas) | Dropdown closes | |

### T2 — Node Selection & Visual Feedback

> **Files:** `figure-canvas.component.ts` (`renderAssignmentNodes`, `updateTransformer`, ad-hoc `click tap` + `dragend` + `dblclick` handlers), `assignment-canvas.component.ts` (`onNodeSelected`, `selectedAdHocNode`)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T2.1 | Single-click an ad-hoc node on the canvas | Node border becomes thicker/highlighted (selected state). Properties panel appears top-left. | |
| T2.2 | After selecting an ad-hoc node → verify properties panel | Properties panel visible at **top-left** of the canvas (not bottom-right) with: Etiqueta, Forma, Dimensions, Rotació, Posició, Color fields. Header shows "Propietats del node" with 🗑️ and ✕ buttons. | |
| T2.3 | Click a regular (template) node | No Transformer handles. No properties panel. Normal selection behavior. | |
| T2.4 | Click empty canvas after selecting a node | Node is deselected. Properties panel disappears. Transformer handles removed. | |
| T2.5 | Hover over an ad-hoc node | Cursor changes to "grab". Tooltip "Node creat manualment" appears. | |
| T2.6 | Drag an ad-hoc node | Node follows cursor. On drop, position is saved to backend. | |
| T2.7 | Double-click an ad-hoc node | Node is selected AND Transformer handles (resize/rotate) appear around the node. | |

### T3 — Properties Panel

> **Files:** `ad-hoc-node-properties.component.ts/html`, `node-assignment.service.ts` (`updateAdHocNode`), `update-ad-hoc-node.dto.ts`

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T3.1 | Change "Etiqueta" field → wait 300ms | Node label updates on the canvas. API call `PATCH` succeeds. | |
| T3.2 | Change "Forma" from El·lipse to Rectangle | Node shape changes visually on canvas after refresh. | |
| T3.3 | Change "Amplada" to 120 and "Alçada" to 60 | Node dimensions update on canvas. | |
| T3.4 | Move the "Rotació" slider to 90° | Node rotates 90° on canvas. | |
| T3.5 | Change X/Y position values | Node moves to the new coordinates. | |
| T3.6 | Change color picker | Node fill color changes. | |
| T3.7 | Try to set label to empty string or spaces only | Backend rejects with validation error. Toast error appears. | |
| T3.8 | Click ✕ (close) button in the panel header | Panel closes, node is deselected. | |
| T3.9 | Click 🗑️ (delete) button in the panel header | Confirmation dialog appears (if node is assigned) or node is deleted immediately. | |
| T3.10 | Scroll the panel when many fields are present | Panel scrolls within its `max-h` bounds without overflowing the canvas area. | |

### T4 — Keyboard Shortcuts

> **Files:** `assignment-canvas.component.ts` (`onKeyDown`, `moveAdHocNodeByKey`), `layout.service.ts` (removed global ESC)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T4.1 | Select an ad-hoc node → press `Delete` or `Backspace` | If unassigned: node is deleted. If assigned: confirmation dialog appears. | |
| T4.2 | Select a template node → press `Delete` | Nothing happens (Delete only works on ad-hoc nodes). | |
| T4.3 | Select an ad-hoc node → press `ArrowRight` | Node moves 1px to the right. | |
| T4.4 | Select an ad-hoc node → press `Shift+ArrowRight` | Node moves 10px to the right. | |
| T4.5 | Test all 4 arrow directions (↑↓←→) | Node moves 1px in each direction. | |
| T4.6 | Test all 4 arrows with Shift | Node moves 10px in each direction. | |
| T4.7 | Press `ESC` with FAB dropdown open | Dropdown closes. | |
| T4.8 | Press `ESC` in placement mode | Placement mode cancels. | |
| T4.9 | Press `ESC` with delete confirmation modal open | Modal closes without deleting. | |
| T4.10 | Press `ESC` with a node selected (no modal/dropdown open) | Node is deselected. Properties panel disappears. | |
| T4.11 | Press `ESC` with nothing selected | Nothing visible happens (no header/sidebar appears). | |
| T4.12 | Press `Tab` | Advances to next empty (unassigned) node. | |
| T4.13 | Focus an input field (e.g., person search) → press Delete | Does NOT delete any node (keyboard shortcuts are disabled when editing text). | |

### T5 — Assignment Flow

> **Files:** `assignment-canvas.component.ts` (`onNodeSelected` → `triggerAssign`), `node-assignment.service.ts`

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T5.1 | Click a person in the right panel → click an ad-hoc node | Person is assigned to the ad-hoc node. Person's alias appears inside the node. | |
| T5.2 | Click an assigned ad-hoc node | Popover appears showing the assigned person with option to unassign. | |
| T5.3 | Unassign person from popover | Person is removed from the node. Node shows label again. | |
| T5.4 | Click two assigned nodes in sequence (ad-hoc + template) | Swap dialog appears. Confirm → persons are swapped. | |
| T5.5 | Assign a person → check "Assignades" section in person panel | Assigned person moves from "Confirmades" to "Assignades" with the node name. | |

### T6 — Delete Ad-Hoc Node

> **Files:** `assignment-canvas.component.ts` (`deleteAdHocNode`, `confirmDeleteAdHocNode`, `cancelDeleteAdHocNode`), `node-assignment.service.ts` (`deleteAdHocNode`), `node-assignment.controller.ts`

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T6.1 | Create an ad-hoc node → select it → press Delete | Node is deleted immediately (no confirmation for unassigned). | |
| T6.2 | Assign a person → select ad-hoc node → press Delete | Confirmation dialog appears with personalized message (node label + person name). | |
| T6.3 | Confirm deletion in the dialog | Node and assignment are deleted. Person returns to "Confirmades" list. | |
| T6.4 | Cancel deletion in the dialog | Nothing is deleted. Node remains. | |
| T6.5 | Delete node via 🗑️ button in properties panel | Same behavior as keyboard Delete. | |
| T6.6 | Try to delete a template (non-ad-hoc) node | Not possible. Delete key does nothing for template nodes. | |

### T7 — Help Modal

> **Files:** `ad-hoc-nodes-help-modal.component.ts/html`, `assignment-canvas.component.html` (`openHelpModal`)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T7.1 | Click the `?` button next to the FAB | Help modal opens with keyboard shortcuts and instructions. | |
| T7.2 | Press ESC or click backdrop to close | Modal closes. | |

### T8 — Import & Reset

> **Files:** `node-assignment.service.ts` (`bulkImport`), `assignment-canvas.component.ts` (`refreshInstanceNodes`)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T8.1 | Create ad-hoc nodes → click "Importar pinya" | Import dialog works. Ad-hoc nodes from source are cloned if not already present. | |
| T8.2 | Import with duplicate ad-hoc nodes (same `originNodeId`) | Duplicates are skipped (idempotency). No error. | |
| T8.3 | Click "Reinicialitzar" | All nodes (including ad-hoc) and assignments are reset to the original template snapshot. | |

### T9 — Edge Cases

> **Files:** Multiple (see individual references)

| # | Test | Expected Result | ✅/❌ |
|---|---|---|---|
| T9.1 | Create multiple ad-hoc nodes rapidly (race condition) | Each gets a unique `sortOrder`. No duplicates. → `node-assignment.service.ts` (atomic transaction) | |
| T9.2 | Network error during ad-hoc creation | Toast error appears. No ghost node on canvas. → `assignment-canvas.component.ts` (`onCanvasClicked`) | |
| T9.3 | Navigate away and return | Ad-hoc nodes persist (loaded from API on segment load). | |
| T9.4 | Locked segment (assignments locked) | FAB button is hidden. No ad-hoc creation/deletion/editing. → `assignment-canvas.component.html` (`!isLocked()` guard) | |
| T9.5 | "Editar template" link | Toast "Els canvis al template no afecten instàncies ja creades." appears, then navigates to template editor. → `assignment-canvas.component.ts` (`onEditTemplate`) | |

---

## Pre-Test Setup

1. `pnpm run docker:up` (PostgreSQL running)
2. `nx serve api` (backend at localhost:3000)
3. `nx serve dashboard` (frontend at localhost:4200)
4. Login with test credentials
5. Navigate to an event segment with at least one figure instance (e.g., "Pinet doble")
6. Ensure the segment is NOT locked
