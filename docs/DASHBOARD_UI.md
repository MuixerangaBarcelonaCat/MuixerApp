---
tags: [qa]
---

# Dashboard UI/UX Guide

Guia d'estils i patrons del dashboard Angular. Tot el desenvolupament futur ha de seguir aquesta línia.

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Angular 21 (standalone, signals, OnPush) |
| Components | DaisyUI v4 (semantic classes) |
| Utilitats | Tailwind CSS v3.4 |
| Icones | lucide-angular (tree-shakeable) |
| Font | Quicksand (self-hosted via `@fontsource`) — veure [[DESIGN_SYSTEM]] |
| Theming | DaisyUI `data-theme`, generat per colla — veure [[DESIGN_SYSTEM]] |

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

## Paleta de colors, tipografia i tokens

Tot el sistema de tokens (color, tipografia, radius, shadow, motion, z-index) i la llibreria de components compartits (`libs/ui`, consumida per dashboard i PWA) viuen ara a [[DESIGN_SYSTEM]] — canonical source of truth per a tot el que és visual. Aquesta secció no es duplica ací.

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
| `app-toast` + `ToastService` | Alertes auto-dismiss (success/error/warning/info) |

Els skeletons són inline (classes `skeleton` de DaisyUI dins `app-data-table`), no components propis.

### Forms

| Component | Descripció |
|-----------|-----------|
| `app-emoji-picker` | Selector d'emoji per a persones |
| `app-person-search-input` | Cerca amb autocompletat de persones |

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

Generació de tema i canvi en runtime — veure la secció *Theming / dark mode* de [[DESIGN_SYSTEM]].

---

*Veïns: [[DESIGN_SYSTEM]] · [[AUDIT_SUITE]] · [[PINYES_MODULE]] · [[DEBT]] · [[MAP]]*
