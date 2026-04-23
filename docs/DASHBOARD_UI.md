# Dashboard UI/UX Guide

Guia d'estils i patrons del dashboard Angular. Tot el desenvolupament futur ha de seguir aquesta línia.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Angular 20 (standalone, signals, OnPush) |
| Components | DaisyUI v4 (semantic classes) |
| Utilitats | Tailwind CSS v3.4 |
| Icones | lucide-angular (tree-shakeable) |
| Font | Inter (400, 500, 600, 700) via Google Fonts |
| Theming | DaisyUI `data-theme` — 1 color primari genera tot el tema |

## Layout

```
┌─────────────────────────────────┐
│  Header (logo + user-chip)      │
├─────────────────────────────────┤
│  Tab Nav (icon+text / icon-only)│
├─────────────────────────────────┤
│  Main (bg-base-200 p-4 lg:p-6) │
│  ┌─────────────────────────┐    │
│  │  <router-outlet />      │    │
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

- **No sidebar** — navegació per tabs horitzontals.
- **Desktop (lg+)**: icon + text tabs.
- **Tablet (sm-lg)**: icon-only tabs.
- **Mobile (<sm)**: hamburger dropdown.
- **Fullscreen mode**: `LayoutService.isFullscreen()` amaga header i tabs.

## Paleta de Colors

Tots els colors via tokens DaisyUI (mai `var(--custom)`):

| Token | Ús |
|-------|-----|
| `primary` | Accions principals, links actius, accent cards |
| `secondary` | Accent secundari, actuacions |
| `base-100` | Fons de cards i modals |
| `base-200` | Fons general de pàgina |
| `base-content` | Text principal |
| `base-content/60` | Text secundari |
| `base-content/40` | Text molt subtil |
| `success` | Confirmats, positius |
| `error` | Rebutjats, destructius |
| `warning` | Pendents, atenció |
| `info` | Informació neutral |

## Tipografia

| Element | Classes |
|---------|---------|
| Títol de pàgina | `text-2xl font-bold` o `text-xl font-bold` |
| Subtítol | `text-base font-semibold` |
| Etiqueta | `text-xs text-base-content/50 font-medium` |
| Valor | `text-sm text-base-content` |
| Text secundari | `text-sm text-base-content/60` |

## Components Compartits

Tots a `shared/components/`:

### Data

| Component | Descripció |
|-----------|-----------|
| `app-page-header` | Títol + badge comptador + slot accions |
| `app-data-table` | Taula genèrica amb sort 3-state, skeleton, group separators, row actions |
| `app-filter-bar` | Wrapper amb `<ng-content>` + botó "Netejar filtres" |
| `app-active-filters` | Badges dismissibles per filtres actius |
| `app-column-toggle` | Collapse amb checkboxes de columnes visibles |
| `app-pagination` | Join buttons + selector per-page + info "Mostrant X-Y de Z" |
| `app-empty-state` | Icona Lucide + missatge + CTA opcional |
| `app-stat-card` | DaisyUI stat card amb icona |

### Feedback

| Component | Descripció |
|-----------|-----------|
| `app-confirm-dialog` | Modal natiu `<dialog>` amb confirmació/cancel |
| `app-toast` + `ToastService` | Alertes auto-dismiss (success/error/warning/info) |
| `app-skeleton-rows` | Files skeleton per taules |
| `app-skeleton-cards` | Grid skeleton per cards |

### Forms

| Component | Descripció |
|-----------|-----------|
| `app-form-field` | Wrapper: label + error + helper |

## Patrons de Pàgina

### Llista (Person list, Event list)

```
page-header → filter-bar → active-filters → column-toggle → data-table → pagination
```

Estat amb signals: `search`, `page`, `limit`, `sortBy`, `sortOrder`, `items`, `loading`, `visibleColumnKeys`.

### Detall (Person detail, Event detail)

Card amb seccions. Loading amb skeleton rows.

### Home (Dashboard)

Cards destacades (pròxim assaig/actuació) + grid de navegació + sync + config.

### Login

Pàgina standalone sense header/tabs. Card centrada.

## Regles d'Estil

1. **DaisyUI primer** — `btn`, `card`, `badge`, `table`, `modal`, etc.
2. **Tailwind per layout** — `flex`, `grid`, `gap`, `p-*`, `mt-*`, etc.
3. **Mai `.scss`** tret d'animacions complexes. Ometre `styleUrls` si no cal.
4. **Mai classes Tailwind dinàmiques** — usar mapes estàtics (`GRID_COLS[n]`).
5. **`[ngClass]`** per afegir classes — mai `[class]` (sobreescriu les estàtiques).
6. **Shared first** — usar components compartits, no HTML manual repetit.
7. **Text en català** — tots els labels, missatges, botons.
8. **Inline template** permès per shared components petits (<40 línies, sense lògica de negoci).

## Routing

| Path | Feature | Lazy |
|------|---------|------|
| `/home` | Dashboard principal | Sí |
| `/persons` | Llista + detall + sync persones | Sí |
| `/rehearsals` | Llista + detall + sync assajos | Sí |
| `/performances` | Llista + detall + sync actuacions | Sí |
| `/sync` | Sincronització global | Sí |
| `/pinyes` | Mòdul figures (placeholder) | Sí |
| `/config` | Configuració (placeholder) | Sí |
| `/login` | Autenticació | No (directe) |

## Theming per Colla

`tailwind.config.js` conté `generateCollaTheme(primaryHex)` que genera tots els tokens DaisyUI a partir d'un sol color primari. Per afegir una nova colla:

```javascript
daisyui: {
  themes: [
    { 'colla-barcelona': generateCollaTheme('#1E3A8A') },
    { 'colla-nova': generateCollaTheme('#D32F2F') },
  ],
}
```

Canvi en runtime: `document.documentElement.setAttribute('data-theme', 'colla-nova')`.
