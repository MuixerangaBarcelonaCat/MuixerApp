# Migration from Spartan UI to DaisyUI

**Date**: 30 March 2026

## Why We Migrated

Spartan UI was in alpha (`0.0.1-alpha.656`) and underwent a breaking package restructure mid-development. The old package names (`@spartan-ng/ui-button-helm`, `@spartan-ng/ui-table-helm`, etc.) were deprecated and frozen at alpha.357 in December 2024.

The new architecture consolidated everything into `@spartan-ng/brain` (npm) + locally generated helm components, but this added complexity and instability for a production project.

## New Stack

- **DaisyUI v4.12.24** (stable, 55 components)
- **Angular CDK v21.2.4** (already installed)
- **Tailwind CSS v3.4.19** (unchanged)

## Benefits

1. **Stability**: DaisyUI v4 is production-ready, widely used, well-documented
2. **Zero JS runtime**: Pure CSS classes, no JavaScript overhead
3. **Built-in theming**: Multi-colla support via `data-theme` attribute
4. **Simpler**: No brain/helm split, no CLI scaffolding, just CSS classes
5. **Future-proof**: Clear migration path to DaisyUI v5 + Tailwind v4 when needed

## Component Mapping

| Spartan UI | DaisyUI + CDK |
|------------|---------------|
| `hlmBtn` | `class="btn btn-primary"` |
| `HlmTable` | `class="table"` |
| `HlmBadge` | `class="badge badge-primary"` |
| `HlmInput` | `class="input input-bordered"` |
| `HlmSelect` | `class="select select-bordered"` |
| `HlmLabel` | `class="label"` |
| `HlmDialog` | `<dialog class="modal">` or CDK Overlay |
| `HlmSheet` | `class="drawer"` |
| `HlmProgress` | `<progress class="progress progress-primary">` |
| `HlmSeparator` | `class="divider"` |
| Icons | Inline SVG (removed lucide-angular dependency) |

## Files Changed

### Dependencies
- [package.json](../package.json) -- Removed `@spartan-ng/cli`, added `daisyui@^4.12.24`
- [tailwind.config.js](../tailwind.config.js) -- Added DaisyUI plugin + custom `colla-barcelona` theme

### Cursor Rules
- **Deleted**: `.cursor/rules/spartan-tailwind.mdc`
- **Deleted**: `.cursor/rules/spartan-ui-tailwind.mdc`
- **Created**: [.cursor/rules/daisyui-cdk.mdc](../.cursor/rules/daisyui-cdk.mdc) -- New patterns with DaisyUI + CDK

### Documentation (8 files)
- [README.md](../README.md)
- [docs/TAILWIND_VERSION.md](TAILWIND_VERSION.md)
- [docs/NEXT_STEPS.md](NEXT_STEPS.md)
- [docs/IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)
- [docs/VALIDATION_CHECKLIST.md](VALIDATION_CHECKLIST.md)
- [docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md](specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md)
- [docs/specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md](specs/2026-03-26-p0-p1-p2-vertical-slice-persons-design.md)
- [.cursor/rules/muixer-project.mdc](../.cursor/rules/muixer-project.mdc)

### Dashboard Components (5 files)
- [apps/dashboard/src/app/app.ts](../apps/dashboard/src/app/app.ts) -- DaisyUI drawer
- [apps/dashboard/src/app/shared/components/layout/header/header.component.ts](../apps/dashboard/src/app/shared/components/layout/header/header.component.ts) -- DaisyUI navbar + button
- [apps/dashboard/src/app/features/persons/components/person-list.component.ts](../apps/dashboard/src/app/features/persons/components/person-list.component.ts) -- DaisyUI table/cards/inputs/selects
- [apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.ts](../apps/dashboard/src/app/features/persons/components/person-detail/person-detail.component.ts) -- DaisyUI badges/labels/collapse
- [apps/dashboard/src/app/features/persons/components/person-sync/person-sync.component.ts](../apps/dashboard/src/app/features/persons/components/person-sync/person-sync.component.ts) -- DaisyUI progress/alert/badges

## Build Status

✅ **API build**: Passes (`npx nx build api`)  
✅ **Dashboard build**: Passes (`npx nx build dashboard`)  
✅ **No Spartan references** in code (verified via grep)

## Multi-Colla Theming

DaisyUI's theme system is perfect for multi-tenant:

```javascript
// tailwind.config.js
daisyui: {
  themes: [
    {
      'colla-barcelona': {
        'primary': '#1B5E20',
        'secondary': '#FDD835',
      },
    },
    {
      'colla-valencia': {
        'primary': '#FF6F00',
        'secondary': '#FFD54F',
      },
    },
  ],
}
```

Switch at runtime:

```html
<html data-theme="colla-barcelona">
```

No CSS variable hacks, no runtime color injection. Clean, native DaisyUI feature.

## Future: Canvas Module (P6)

DaisyUI won't conflict with canvas rendering. Canvas will use Konva.js/Fabric.js/native Canvas API for drawing. DaisyUI provides the chrome around it:

- `tabs` for property panels
- `tooltip` for piece info
- `popover` for context menus
- `slider` for zoom/rotation
- `toggle` for edit modes
- `command` for command palette
- `dropdown-menu` for piece actions
- `dialog` for figure config

Angular CDK provides drag-drop for canvas interactions.

## References

- [DaisyUI v4 Documentation](https://v4.daisyui.com/)
- [DaisyUI Components](https://v4.daisyui.com/components)
- [DaisyUI Themes](https://v4.daisyui.com/docs/themes)
- [Angular CDK Documentation](https://material.angular.io/cdk/categories)
