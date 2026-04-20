# Dashboard Design Refactor — Spec

**Data**: 2026-04-20
**Estat**: Aprovat
**Aproximació**: Clean Slate de la Capa Visual (Opció B)

## Resum Executiu

Refactorització completa de la capa de disseny del Dashboard de MuixerApp. S'eliminen tots els templates HTML i estils existents, mantenint intacta la lògica TypeScript (services, models, signals, data loading). Es reconstrueix des de zero amb un nou layout, una llibreria de components shared reutilitzables, i un design system coherent basat en DaisyUI.

### Objectius

- UX intuïtiva per a usuaris no-experts
- Components reutilitzables per a features actuals i futures
- Navegació per tabs (eliminar sidebar) amb suport per fullscreen (Pinyes)
- Estil net, blanc, sense dark mode
- Personalització mínima per colla (1 color)
- Disseny escalable per a mòduls pendents (Pinyes, Configuració)

---

## 1. Design System i Tema DaisyUI

### 1.1 Filosofia: "1 Color, Tot Generat"

Cada colla defineix **1 sol color** (`primary`). El sistema genera automàticament la resta de la paleta.

### 1.2 Paleta de Colors

| Token DaisyUI | Valor | Origen |
|---|---|---|
| `primary` | Color de la colla (ex: `#1E3A8A`) | Configurat per colla |
| `primary-content` | Blanc o negre (autocontrast WCAG 4.5:1) | Calculat |
| `secondary` | Variant tonal del primary (desaturat, +20% luminositat) | Calculat |
| `accent` | Complement del primary (rotació 180° del hue) | Calculat |
| `neutral` | `#1f2937` (slate-800) | Fix |
| `base-100` | `#ffffff` | Fix |
| `base-200` | `#f8fafc` (slate-50) | Fix |
| `base-300` | `#f1f5f9` (slate-100) | Fix |
| `base-content` | `#1e293b` (slate-800) | Fix |
| `info` | `#3b82f6` | Fix |
| `success` | `#22c55e` | Fix |
| `warning` | `#f59e0b` | Fix |
| `error` | `#ef4444` | Fix |

Una funció `generateCollaTheme(primaryHex)` a `tailwind.config.js` generarà el tema complet.

### 1.3 Tipografia

- **Font principal**: `Inter` (Google Fonts) — pesos 400, 500, 600, 700
- **Escala**: 12 / 14 / 16 (base) / 18 / 20 / 24 / 30 px
- `base-content` sobre `base-100` = ratio 12.6:1 (WCAG AAA)
- `line-height`: 1.5 per body text

### 1.4 Icones

- **Lucide Icons** (`lucide-angular` o SVG inline) — stroke-based, 24px base
- Zero emojis com a icones estructurals en el codi final

### 1.5 Spacing i Radis

- Sistema 4px/8px natiu de Tailwind
- Cards: `rounded-xl` (12px) amb `shadow-sm`
- Separació entre seccions: `space-y-6`
- Touch targets: mínim `44x44px` en mòbil

### 1.6 No Dark Mode

- Només mode clar
- `daisyui.darkTheme` desactivat explícitament a `tailwind.config.js`

---

## 2. Layout Shell — Top Bar amb Tabs

### 2.1 Estructura

Substitueix el pattern `drawer/sidebar` actual per un top bar de 2 nivells:

```
┌──────────────────────────────────────────────────────────┐
│  🔷 MuixerApp                            👤 Joan (Admin) │  Brand bar
├──────────────────────────────────────────────────────────┤
│  Inici · Persones · Assajos · Actuacions · Pinyes · ⚙️  │  Tab bar
├──────────────────────────────────────────────────────────┤
│                    <router-outlet>                        │  Content area
└──────────────────────────────────────────────────────────┘
```

### 2.2 Brand Bar (`app-header`)

- **Esquerra**: Logo colla (dinàmic) + text "MuixerApp"
- **Dreta**: `app-user-chip` (avatar + nom + rol + dropdown logout)
- **Sense cerca global** — la cerca viu dins de cada feature
- **Estil**: `navbar bg-base-100 border-b border-base-300`
- **Mòbil**: Logo + hamburger (obre menú desplegable amb els tabs)

### 2.3 Tab Bar (`app-tab-nav`)

- Component standalone amb tabs horitzontals
- Estil: `tabs tabs-bordered` dins `bg-base-100`
- Tab actiu: `tab-active` amb accent inferior en `primary`
- Items: Inici | Persones | Assajos | Actuacions | Pinyes | Configuració
- Cada tab: `routerLink` + `routerLinkActive`
- **Responsive**:
  - Desktop (≥1024px): Icona + text
  - Tablet (768-1023px): Només icona amb `tooltip`
  - Mòbil (<768px): Hamburger → DaisyUI `dropdown dropdown-bottom` amb llista vertical d'icones + text

### 2.4 Àrea de Contingut

- `bg-base-200` amb `p-4 lg:p-6`
- `overflow-y-auto` per scroll vertical
- `<router-outlet>` renderitza features

### 2.5 Mode Fullscreen (per Pinyes)

- El shell exposa un signal `isFullscreen` (default `false`)
- El component Pinyes pot sol·licitar fullscreen via un servei compartit (`LayoutService.requestFullscreen()`)
- Quan `isFullscreen() === true`, el shell renderitza **només** el `<router-outlet>` sense brand bar ni tab bar (rendering condicional amb `@if`, no CSS display:none)
- Dins del component Pinyes en fullscreen: botó flotant `btn btn-circle btn-ghost fixed top-4 left-4 z-50` per sortir
- `Escape` com a drecera de teclat per sortir de fullscreen
- `LayoutService.exitFullscreen()` per sortir programàticament

### 2.6 Component Tree

```
App
├── @if (isAuthRoute()) → <router-outlet> (login)
├── @else @if (isFullscreen()) → <router-outlet> (pinyes fullscreen, sense chrome)
├── @else
│   ├── app-header            ← Brand bar
│   ├── app-tab-nav           ← Tab navigation
│   └── main.content-area     ← <router-outlet>
```

---

## 3. Llibreria de Components Shared

### 3.1 Components de Layout

| Component | Responsabilitat | DaisyUI |
|---|---|---|
| `app-header` | Brand bar: logo + user-chip | `navbar bg-base-100 border-b` |
| `app-tab-nav` | Tabs de navegació principals | `tabs tabs-bordered` |
| `app-user-chip` | Avatar + nom + dropdown logout | `dropdown dropdown-end`, `avatar`, `menu` |
| `app-page-container` | Wrapper de pàgina amb estructura consistent | `space-y-6` |

### 3.2 Components de Dades

| Component | Responsabilitat | DaisyUI |
|---|---|---|
| `app-page-header` | Títol + badge comptador + botons d'acció | `flex justify-between items-center` |
| `app-data-table<T>` | Taula genèrica: sort, scroll-x, row actions, group separator | `table table-sm`, `overflow-x-auto` |
| `app-column-toggle` | Selector de columnes (collapse) | `collapse collapse-arrow` |
| `app-filter-bar` | Barra de filtres: search + selects + clear | `flex flex-wrap gap-2`, `input`, `select` |
| `app-active-filters` | Badges de filtres actius amb dismiss | `badge badge-outline` |
| `app-pagination` | Paginació + selector de límit | `join`, `btn btn-sm` |
| `app-empty-state` | Estat buit: icona + missatge + acció | `card bg-base-100 text-center` |
| `app-stat-card` | Card KPI: valor + label + tendència | `stat` |

### 3.3 Components de Feedback

| Component | Responsabilitat | DaisyUI |
|---|---|---|
| `app-skeleton-rows` | Loading skeleton per a taules | `skeleton` |
| `app-skeleton-cards` | Loading skeleton per a cards | `skeleton` |
| `app-confirm-dialog` | Diàleg de confirmació destructiva | `modal`, `modal-box` |
| `app-toast` | Notificacions toast (servei + component) | `toast`, `alert` |

### 3.4 Components de Formulari

| Component | Responsabilitat | DaisyUI |
|---|---|---|
| `app-form-field` | Wrapper: label + input + error + helper text | `form-control`, `label` |
| `app-person-search-input` | Cerca persones amb autocomplete (ja existeix, es poleix) | `input`, `dropdown`, `menu` |

### 3.5 Principis

- **Inputs via `input()` / `input.required()`** — no `@Input()` clàssic
- **Outputs via `output()`** — no `@Output() EventEmitter`
- **Genèrics**: `app-data-table<T>` rep `items: T[]` + `columns: ColumnDef<T>[]`
- **Zero lògica de negoci** — pura presentació
- **`host: { class: 'block' }`** a tots els components
- **OnPush** a tots els components
- **Standalone** a tots els components

### 3.6 YAGNI — No es creen

- Breadcrumbs (navegació plana per tabs)
- Sidebar (eliminat)
- Chart components (es faran amb P3+)
- Drag & drop wrappers (Pinyes ho definirà en P6)
- Storybook (massa overhead per l'escala actual)

---

## 4. Home Tab — Pàgina d'Inici

### 4.1 Objectiu

Punt d'entrada orientatiu per a no-experts. Respon: "Què està passant a la colla ara mateix?"

### 4.2 Zones

#### Zona 1: Salutació
- `Benvingut/da, {{nom}}`
- Text simple, personalitzat

#### Zona 2: Cards Destacades (fila superior)

Dues cards prominents, 2 columnes en desktop, stack en mòbil:

**Pròxim Assaig**:
- Data, hora, lloc
- Recompte d'assistència: apuntats / no venen / pendents
- Link "Veure detall →"
- Si no n'hi ha: `app-empty-state` "Cap assaig programat"

**Pròxima Actuació**:
- Mateixa estructura que assaig
- Si no n'hi ha: `app-empty-state` "Cap actuació programada"

#### Zona 3: Cards de Navegació (grid)

4 columnes en desktop, 2 en mòbil:
- **Persones**: icona Lucide + "143 membres" + link gestió
- **Assajos**: icona + comptador temporada + link llistat
- **Actuacions**: icona + comptador temporada + link llistat
- **Pinyes**: icona + comptador figures + link canvas

Estil: `card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer` amb `border-l-4 border-primary`

#### Zona 4: Sincronització (fila intermitja)

Card d'acció temporal (aquesta funcionalitat desapareixerà quan MuixerApp sigui l'app principal):
- **Botó prominent**: "🔄 Sincronitzar totes les dades legacy"
- Link a `/sync` (ruta global de sincronització)
- Estil: `card bg-warning/10 border-l-4 border-warning`
- Missatge explicatiu: "Importa dades des de l'aplicació antiga (Persones, Assajos, Actuacions)"

#### Zona 5: Configuració (fila final)

Card secundària amb links inline: Usuaris · Etiquetes · Temporada
Estil: `bg-base-200` sense shadow, menys prominent

### 4.3 Dades

- `HomeComponent` fa crides API:
  - `GET /events?type=rehearsal&upcoming=true&limit=1`
  - `GET /events?type=performance&upcoming=true&limit=1`
- Comptadors (persones, events) via crides lleugeres o cache en servei

### 4.4 Sincronització Legacy

La zona de sincronització és **temporal** i desapareixerà quan MuixerApp esdevingui l'aplicació principal. Per ara és necessària per importar dades.

### 4.5 Responsive

| Viewport | Cards destacades | Cards navegació | Sincronització | Config |
|---|---|---|---|---|
| Desktop (≥1024px) | 2 columnes | 4 columnes | 1 fila | 1 fila inline |
| Tablet (768-1023px) | 2 columnes | 2 columnes | 1 fila | 1 fila inline |
| Mòbil (<768px) | 1 columna | 2 columnes | 1 fila | 1 columna |

---

## 5. Pàgines de Llista

### 5.1 Patró Comú

Totes les llistes (Persones, Assajos, Actuacions) segueixen la mateixa estructura visual:

```
app-page-header  →  Títol (N)  +  Botons acció (Nova / Sync)
app-filter-bar   →  Cerca + Selects + Netejar
app-active-filters → Badges de filtres actius
app-column-toggle → Collapse per columnes visibles
app-data-table   →  Taula amb sort + scroll-x + accions fila
app-pagination   →  Paginació + selector límit
```

La lògica TS de signals (search, filters, sort, pagination) es manté intacta dels components actuals.

#### Botó de Sincronització

**IMPORTANT**: Totes les llistes inclouen un botó **"🔄 Sincronitzar"** al `app-page-header`:
- Estil: `btn btn-outline btn-warning btn-sm`
- Posició: A la dreta del botó d'acció principal (ex: "+ Nova")
- Funcionalitat: Navega a la ruta de sync de la feature (`/persons/sync`, `/rehearsals/sync`, `/performances/sync`)
- **És temporal** — aquesta funcionalitat s'eliminarà quan MuixerApp sigui l'app principal

### 5.2 `app-data-table<T>`

**Inputs**:

| Input | Tipus | Descripció |
|---|---|---|
| `items` | `T[]` | Dades |
| `columns` | `ColumnDef<T>[]` | Definicions de columnes |
| `visibleColumns` | `string[]` | Claus visibles |
| `sortBy` | `string \| undefined` | Camp ordenat |
| `sortOrder` | `SortOrder \| undefined` | ASC / DESC |
| `loading` | `boolean` | Mostra skeleton |
| `groupSeparator` | `{ predicate: (item: T) => boolean, label: string }` | Separador visual entre grups |

**Outputs**:

| Output | Tipus | Descripció |
|---|---|---|
| `rowClick` | `T` | Fila clicada |
| `sortChange` | `{ field: string, order: SortOrder }` | Capçalera clicada |

**Característiques**:
- Scroll horitzontal: `overflow-x-auto`
- Primera columna sticky: `sticky left-0 bg-base-100 z-[1]`
- Capçalera sticky: `sticky top-0 z-10 bg-base-100`
- Columna d'accions: dropdown DaisyUI amb accions per fila
- Loading: `app-skeleton-rows` (5-10 files)
- Empty: `app-empty-state`

### 5.3 Llistes d'Events — Separació Temporal

Les llistes d'Assajos i Actuacions tenen lògica visual específica:

- **Ordenació per defecte**: `date ASC` — pròxim event primer
- **Separador visual**: fila divisòria "Events passats" entre futurs i passats
- **Files passades**: `opacity-60` — clarament secundàries però clicables
- **Implementació**: via `groupSeparator` de `app-data-table`:
  ```typescript
  groupSeparator: {
    predicate: (event) => isPast(event.date),
    label: 'Events passats'
  }
  ```

### 5.4 Diferències per Feature

| Feature | Filtres | Columnes per defecte | Accions fila | Sync |
|---|---|---|---|---|
| Persones | Posició, Estat, Etiquetes | Nom, Malnom, Posició, Estat, Alçada | Veure detall | `/persons/sync` |
| Assajos | Temporada, Mes | Data, Lloc, Hora, Assistència | Veure, Editar | `/rehearsals/sync` |
| Actuacions | Temporada, Mes | Data, Nom, Lloc, Assistència | Veure, Editar | `/performances/sync` |

---

## 6. Pàgines de Detall

### 6.1 Estructura Comuna

```
app-page-header  →  ← Tornar a [llista]  +  Títol  +  [Editar]
Grid 2 col       →  Cards de seccions amb camps clau-valor
```

- **Botó tornar**: `routerLink` al llistat (no `history.back()`)
- **Layout**: Grid 2 columnes desktop, stack mòbil
- **Cards**: `card bg-base-100 shadow-sm` amb `card-body`
- **Camps**: Label `text-base-content/60` + Valor `font-medium`

### 6.2 Detall de Persona

- Card "Informació bàsica": Malnom, Alçada, Data alta
- Card "Detalls": Posició, Estat, Etiquetes
- Secció futura: "Historial d'assistència" → placeholder `app-empty-state`

### 6.3 Detall d'Event

- Card "Informació": Data, Hora, Lloc, Tipus
- Card "Assistència": Llista apuntats/no venen/pendents amb badges
- Modal editar assistència (existent, es poleix)

---

## 7. Mòduls Futurs (Esquelet)

### 7.1 Pinyes (P6)

- Ruta `/pinyes` amb lazy loading
- `PinyesPlaceholderComponent`: `app-empty-state` "Mòdul en desenvolupament"
- Estructura de carpetes `features/pinyes/` preparada
- Toggle fullscreen ja definit al shell
- CDK Drag & Drop disponible com a dependència

### 7.2 Configuració

- Ruta `/config` amb sub-rutes:
  - `/config/users` → Placeholder
  - `/config/tags` → Placeholder
  - `/config/seasons` → Placeholder
- Cada sub-secció reutilitzarà els components shared
- `ConfigComponent` mostra cards de navegació a les sub-seccions

---

## 8. Mapa de Rutes

```
/login                    → LoginComponent
/                         → redirect → /home
/home                     → HomeComponent
/sync                     → GlobalSyncComponent (nou - sincronitza tot)
/persons                  → PersonListComponent
/persons/:id              → PersonDetailComponent
/persons/sync             → PersonSyncComponent
/rehearsals               → EventListComponent (data: { eventType: 'rehearsal' })
/rehearsals/:id           → EventDetailComponent
/rehearsals/sync          → EventSyncComponent (nou - type: rehearsal)
/performances             → EventListComponent (data: { eventType: 'performance' })
/performances/:id         → EventDetailComponent
/performances/sync        → EventSyncComponent (nou - type: performance)
/pinyes                   → PinyesPlaceholderComponent
/config                   → ConfigComponent
/config/users             → Placeholder
/config/tags              → Placeholder
/config/seasons           → Placeholder
```

Totes les rutes excepte `/login` protegides amb `authGuard` + `rolesGuard`.

### 8.1 Rutes de Sincronització (Temporal)

Les següents rutes són **temporals** i s'eliminaran quan MuixerApp sigui l'app principal:
- `/sync` — Sincronització global (persones + events)
- `/persons/sync` — Sincronització només persones
- `/rehearsals/sync` — Sincronització només assajos
- `/performances/sync` — Sincronització només actuacions

Cada pàgina de sync segueix el mateix patró:
- `app-page-header` amb botó "← Tornar"
- Card explicativa amb missatge warning
- Botó d'acció: "Iniciar sincronització"
- Zona de feedback: progress bar + log de missatges
- Al finalitzar: botó "Anar a [llista]"

---

## 9. Abast i Exclusions

### Dins de l'abast

- Eliminar tots els templates HTML i estils del dashboard
- Nou `tailwind.config.js` amb `generateCollaTheme()`
- Instal·lar `Inter` font + `lucide-angular`
- Nous components shared (Secció 3)
- Nou layout shell (Secció 2)
- Reconstruir templates de: Home, Persones (list + detail + sync), Events (list + detail + sync), Login
- Crear esquelet: Pinyes, Config
- Crear pàgines de sync: GlobalSyncComponent, PersonSyncComponent (polir existent), EventSyncComponent (nou)
- Actualitzar rutes (`app.routes.ts`)

### Fora de l'abast

- Lògica TypeScript de services/models/signals (es manté intacta)
- Backend API (cap canvi)
- Mòdul Pinyes complet (P6)
- Mòdul Config complet (sub-seccions)
- Cerca global
- Dark mode
- Tests e2e dels nous components
- PWA app (`apps/pwa`)

---

## 10. Dependències Noves

| Paquet | Motiu |
|---|---|
| `lucide-angular` | Icones consistents SVG |
| `@fontsource/inter` o Google Fonts link | Tipografia Inter |

No es necessiten altres dependències. DaisyUI v4, Tailwind v3, Angular CDK ja estan instal·lats.

---

## 11. Riscos

| Risc | Mitigació |
|---|---|
| Regressió funcional en eliminar templates | La lògica TS no es toca; testing manual post-reconstrucció |
| `generateCollaTheme()` no genera bon contrast | Validar amb WCAG contrast checker; fallback a paleta fixa |
| `app-data-table` genèric massa complex | Començar simple, afegir features incrementalment |
| Pinyes fullscreen mode trencant navegació | Testejar toggle amb browser back/forward |
