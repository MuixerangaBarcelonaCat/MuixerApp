# Template Editor — Tablet UX Improvements

**Date:** 2026-08-12
**Status:** Draft
**Scope:** Template editor properties panel — tablet-friendly quick actions

---

## Problem

The template editor properties panel (`/pinyes/templates/:id/edit`) lacks touch-friendly
controls for common operations. On tablet:

- **No way to duplicate a node** (requires Cmd+D keyboard shortcut)
- **No way to create a ghost clone** (requires 250ms hover + click on canvas)
- **No way to move nodes by precise px** (requires arrow keys / Shift+arrow)
- **No way to resize nodes by precise px** (number inputs require virtual keyboard)
- **No way to change a node's color** (fixed at creation by preset, no picker)
- **Delete button** is in the left toolbar, disconnected from the properties panel

## Solution

Add 3 new standalone shared components and reorganize the properties panel to include
a "Quick actions" section with touch-optimized controls.

---

## Architecture

### New components

```
shared/components/forms/
  color-picker/                  -- Swatch grid + hex input popover
    color-picker.component.ts
    color-picker.component.html
    color-picker.component.scss
    color-picker.component.spec.ts

shared/components/controls/
  node-dpad/                     -- D-pad with position/size mode toggle
    node-dpad.component.ts
    node-dpad.component.html
    node-dpad.component.scss
    node-dpad.component.spec.ts

  node-actions/                  -- Duplicate / Ghost / Delete buttons
    node-actions.component.ts
    node-actions.component.html
    node-actions.component.scss
    node-actions.component.spec.ts
```

### Modified files

- `template-editor.component.html` -- add color picker in properties, add quick actions section
- `template-editor.component.ts` -- wire new component outputs, expose `canGhost` computed
- `template-editor.component.scss` -- sticky bottom / collapsable section styles

---

## Component specifications

### 1. ColorPickerComponent

**Location:** `shared/components/forms/color-picker/`

**API:**

```typescript
@Component({
  selector: 'app-color-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ColorPickerComponent {
  color = input<string | null>(null);
  presetColors = input<string[]>([]);
  colorChange = output<string>();
}
```

**Behavior:**

1. Renders a small swatch (24x24px, rounded) showing the current color.
   On hover/focus: pencil icon overlay.
2. Click opens a popover (CDK Overlay, positioned to the left or above depending on
   available space) containing:
   - **Preset swatch grid**: 4-column grid of circular color swatches from `presetColors`.
     Click selects immediately and emits `colorChange`.
   - **Hex input**: text input with `#` prefix, validates `#RRGGBB` format.
     Emits `colorChange` on blur if valid.
3. Popover closes on: click outside, Escape key, swatch selection.
4. No emission while typing in hex input (only on blur with valid value).

**Preset colors by zone** (passed from parent):

- PINYA: 9 colors from `PINYA_NODE_PRESETS` (agulla teal, mans yellow, etc.)
- TRONC: 8 colors from `TRONC_NODE_PRESETS` (segona blue, terca green, etc.)
- BASE/Direction/Decoration: generic palette of 12 common colors

**Popover size:** ~200px wide, auto-height based on swatch count.

**Accessibility:**
- Trigger: `role="button"`, `aria-label="Selector de color"`, `aria-expanded`
- Popover: `role="dialog"`, `aria-label="Tria un color"`
- Swatches: `role="option"`, `aria-label` with color name or hex
- Hex input: proper `<label>`
- Keyboard: Tab through swatches, Enter to select, Escape to close

**Placement in properties panel:** Between the label field and the indicator field
(or between label and shape for non-PINYA nodes). Shows as:

```
Etiqueta   [ VENT          ]
Color      [##] ← swatch (click to open popover)
Indicador  [ V             ]
```

### 2. NodeDpadComponent

**Location:** `shared/components/controls/node-dpad/`

**API:**

```typescript
@Component({
  selector: 'app-node-dpad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeDpadComponent {
  disabled = input(false);
  move = output<{ dx: number; dy: number }>();
  resize = output<{ dw: number; dh: number }>();
}
```

**Layout (~140px wide x ~120px tall):**

```
  Mode: [ Posicio | Mida ]     Step: [ 1 | 10 ]

              [ ↑ ]
        [ ← ] [ · ] [ → ]
              [ ↓ ]
```

**Behavior:**

- **Mode toggle** (DaisyUI `join` buttons): switches between Position and Size mode.
  - Position mode: arrows emit `move` with `{ dx, dy }` deltas
  - Size mode: left/right change width (`resize` with `{ dw: -step, dh: 0 }`),
    up/down change height (`resize` with `{ dw: 0, dh: -step }`)
- **Step toggle** (mini toggle): 1px or 10px increments
- **Arrow buttons**: 36x36px minimum (WCAG 2.5.8 target size for touch)
- **Long press**: holding an arrow button > 300ms starts repeating the action every
  100ms until `pointerup`/`pointercancel`. Uses `pointerdown`/`pointerup` events
  (works for both mouse and touch).
- Center dot is decorative only.

**Accessibility:**
- Container: `role="group"`, `aria-label="Control de moviment del node"`
- Each arrow: `role="button"`, `aria-label` (e.g., "Mou amunt 1 pixel")
- Mode toggle: `role="radiogroup"`, each option `role="radio"` with `aria-checked`
- Step toggle: `role="switch"`, `aria-label="Pas de moviment"`

### 3. NodeActionsComponent

**Location:** `shared/components/controls/node-actions/`

**API:**

```typescript
@Component({
  selector: 'app-node-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NodeActionsComponent {
  canDuplicate = input(false);
  canGhost = input(false);
  duplicate = output<void>();
  ghost = output<void>();
  delete = output<void>();
}
```

**Layout (horizontal row of 3 buttons):**

```
[ Duplica ] [ Fantasma ] [ Elimina ]
```

- `Duplica`: Lucide `Copy` icon + "Duplica" text. Disabled when `!canDuplicate`.
- `Fantasma`: Lucide `Ghost` icon + "Fantasma" text. Disabled when `!canGhost`.
  Tooltip when disabled: "Nomes disponible per nodes PINYA exteriors de rengla"
- `Elimina`: Lucide `Trash2` icon + "Elimina" text. `btn-error btn-outline`.
  Always enabled (parent hides the whole section when no node selected).
- All buttons: `btn btn-sm btn-ghost` (except delete: `btn-outline btn-error`).
  Min height 44px for touch.

**Accessibility:**
- Container: `role="toolbar"`, `aria-label="Accions del node"`
- Each button: descriptive `aria-label`, disabled state reflected
- Disabled ghost tooltip: `title` attribute

---

## Properties panel layout changes

### Current structure (no changes to existing fields)

```
┌───────────────────────────────┐
│ Propietats del node           │
│ ─────────────────             │  <- scrollable area
│ Tipus de posicio (PINYA only) │
│ Etiqueta                      │
│ Color [swatch]      <- NEW    │
│ Indicador (PINYA only)        │
│ Forma                         │
│ Dimensions (W x H)           │
│ Rotacio                       │
│ X, Y                         │
│ Pis (z) (direction only)     │
├───────────────────────────────┤
│ ▼ Accions rapides   <- NEW    │  <- sticky (tablet) / collapsable (desktop)
│                               │
│  Mode: [Pos|Mida] Step:[1|10] │
│        [ ↑ ]                  │
│  [ ← ] [ · ] [ → ]           │
│        [ ↓ ]                  │
│                               │
│ [Duplica] [Fantasma] [Elimina]│
└───────────────────────────────┘
```

### Responsive behavior

**Tablet** (`max-width: 1024px`):
- Quick actions section is **sticky** at the bottom of the panel.
- The properties area above it scrolls independently.
- Separator line between properties and quick actions.
- Section header "Accions rapides" visible but not toggleable.

**Desktop** (`> 1024px`):
- Quick actions section is **collapsable** with a clickable header.
- Header: "Accions rapides ▼" / "Accions rapides ▲" toggles visibility.
- Default state: **collapsed** (desktop users have keyboard shortcuts).
- State persisted in `localStorage` key `muixer_quick_actions_expanded`.

### Delete button migration

The existing delete button in `editor-toolbar` (left sidebar) is **kept** for
desktop users but the primary delete action moves to the quick actions section.
Both fire the same `deleteSelectedNode()` method. No duplication of logic.

---

## Ghost clone eligibility

The `canGhost` input for `NodeActionsComponent` requires a new computed signal in
`template-editor.component.ts`:

```typescript
readonly canGhostSelectedNode = computed(() => {
  const node = this.selectedNode();
  if (!node) return false;
  const renglaMax = this.computeRenglaMax(node);
  return isGhostEligible(node, renglaMax);
});
```

This reuses `isGhostEligible(node, renglaMax)` from `ghost-clone.util.ts`, which
checks: zone must be PINYA, not a central node (agulla/crossa/contrafort/tap), not
cordo-obert, and must be at the outermost rengla position (`renglaPosition === renglaMax`).
`renglaMax` is the maximum `renglaPosition` across all nodes sharing the same `renglaId`.

When the ghost button is clicked, the template editor:
1. Gets the selected node
2. Calls `calculateGhostPosition(node)` from `ghost-clone.util.ts` to compute the
   target position (placed behind the node based on its rotation angle)
3. Calls `onGhostCloneRequested({ sourceNode, targetPosition })` -- the existing
   method already handles clone creation, undo snapshot, and autosave.

---

## Color picker integration

When the user selects a color via the picker:

1. `template-editor` calls `updateSelectedNodeProp('color', hex)`.
2. This triggers `pushSnapshot` + `updateNode` + `scheduleAutosave`.
3. The canvas re-renders with the new color (already reactive via `pinyaNodes` signal).

Preset colors array is derived per zone from `PINYA_NODE_PRESETS`,
`TRONC_NODE_PRESETS`, etc. A utility function `getPresetColorsForZone(zone)` returns
the appropriate array.

---

## Debounce and performance

- **Color picker**: no debounce needed (emits only on swatch click or hex blur).
- **D-pad long press**: the repeat interval (100ms) may trigger many `updateNode` calls.
  Mitigation: the long press batches snapshots -- only ONE undo snapshot is pushed at
  `pointerdown`, and subsequent repeats skip `pushSnapshot`. Autosave is debounced
  (existing 1s debounce in `scheduleAutosave`).
- **D-pad single click**: normal flow (snapshot + update + autosave).

---

## Testing plan

Each new component gets unit tests:

- **ColorPickerComponent**: swatch selection emits correct hex, popover opens/closes,
  hex input validation, preset colors rendered, accessibility attributes.
- **NodeDpadComponent**: mode toggle switches output, step toggle changes delta,
  single click emits correct delta, long press emits repeated deltas, disabled state.
- **NodeActionsComponent**: button disabled states, output emissions, tooltip on
  disabled ghost button.
- **Template editor integration**: color picker updates node, D-pad moves/resizes node,
  actions fire correct methods, quick actions sticky on tablet, collapsable on desktop.

---

## Out of scope

- Tronc view color picker (future reuse of ColorPickerComponent)
- Segment workspace ad-hoc node color picker (future reuse)
- Canvas-level ghost clone UX changes
- New keyboard shortcuts
