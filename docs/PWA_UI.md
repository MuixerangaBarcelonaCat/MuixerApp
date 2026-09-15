---
tags: [qa]
---

# PWA UI/UX Guide

Guia d'estils i patrons de la PWA de membres (Angular). Tot el desenvolupament futur ha de seguir aquesta línia. Resol l'"Open question 2" del pla de disseny ([docs/superpowers/specs/2026-08-16-design-system-plan-design.md](superpowers/specs/2026-08-16-design-system-plan-design.md)) ara que la PWA té prou estructura pròpia (routing, chrome, patrons de pàgina) per merèixer el mateix tractament que [[DASHBOARD_UI]].

## Stack

| Capa | Tecnologia |
|------|-----------|
| Framework | Angular 21 (standalone, signals, OnPush, `rxResource`) |
| Components | `@muixer/ui` — la mateixa llibreria que el dashboard, veure [[DESIGN_SYSTEM]] |
| Utilitats | Tailwind CSS v3.4 + DaisyUI v4 |
| Icones | lucide-angular, sempre `[img]` (mai `[name]` — evita dependre del `LUCIDE_ICONS` provider) |
| Font | Quicksand/Fraunces/Atkinson Hyperlegible Next (self-hosted via `@fontsource`) — veure [[DESIGN_SYSTEM]] |
| Theming | DaisyUI `data-theme`, generat per colla — veure [[DESIGN_SYSTEM]] |
| Offline | Service Worker (cache offline; encara sense push nadiu — veure `CLAUDE.md` §Members PWA) |

## Layout

```
┌───────────────────────────────┐
│  app-mobile-header (opcional) │  ← per pantalla, [showBack]/[fallbackRoute]/[alwaysFallback]
├───────────────────────────────┤
│  <router-outlet />            │  ← main, max-w-2xl mx-auto, pb-20
├───────────────────────────────┤
│  app-bottom-tab-bar           │  ← Inici / Agenda / Perfil
└───────────────────────────────┘
```

- **`AppShellComponent`** (`core/layout/app-shell/`) és l'arrel de tota pantalla autenticada: banner de compte no vinculat (`lib-alert`), banner d'instal·lació (`app-install-prompt-banner`), `<router-outlet>`, `app-bottom-tab-bar`, `app-push-permission-banner` i el `app-consent-modal` (legal) quan cal.
- **`LayoutService.isFullscreen()`** amaga tot el chrome (header, tab bar, banners). L'única pantalla que ho fa servir és `segment-projection` (la projecció d'una pinya).
- **`app-mobile-header`**: `<h1>` en `font-serif`, botó "Torna enrere" opcional (`[showBack]`). El back button prefereix l'historial real del navegador (`Location.back()`) i només cau a `[fallbackRoute]` quan no n'hi ha — tret que `[alwaysFallback]` estiga actiu, per a pantalles amb més d'un origen possible (p. ex. `event-detail`, obert des de l'inici, l'agenda o el calendari: sempre torna a `/events`, no a "d'on vinguera l'usuari").
- **Sense sidebar ni tabs de secció** (a diferència del dashboard) — la navegació és `app-bottom-tab-bar` (3 pestanyes fixes) + el back button d'`app-mobile-header` per a pantalles de detall.
- **Pantalles fullscreen amb botó físic d'arrere**: `segment-projection` intercepta `@HostListener('window:popstate')` perquè el botó d'arrere del navegador torne sempre a l'esdeveniment, no allà on l'historial real diguera — mateix patró que `ProjectionViewComponent.onPopState` al dashboard.

## Paleta de colors, tipografia i tokens

Tot el sistema de tokens (color, tipografia, radius, shadow, motion, z-index) i la llibreria de components compartits (`libs/ui`) viuen a [[DESIGN_SYSTEM]] — no es duplica ací. La PWA consumeix exactament els mateixos components que el dashboard (`lib-button`, `lib-card`, `lib-input`, `lib-select`, `lib-checkbox`, `lib-modal`, `lib-alert`, `lib-badge`, `lib-empty-state`, `lib-tabs`, `lib-toast-container`).

## Components propis de la PWA

Cap equivalent a `libs/ui` (Tier 3 en el vocabulari del pla de disseny) — viuen a `shared/components/`:

| Component | Descripció |
|-----------|-----------|
| `app-mobile-header` | Capçalera de pantalla: `<h1>` + back button opcional + slot `trailing` |
| `app-bottom-tab-bar` | Navegació inferior fixa (Inici/Agenda/Perfil) |
| `app-skeleton-card` | Placeholder de càrrega (targeta amb línies `bg-base-300 animate-pulse`) |
| `app-pull-to-refresh` | Gest natiu de mòbil "estirar per actualitzar" |
| `app-install-prompt-banner` | Suggeriment d'instal·lar la PWA (embolcalla `lib-alert`) |
| `app-push-permission-banner` | Sol·licitud de permís de notificacions push — bàner flotant, en cru per disseny (veure [[DEBT]] F10) |
| `app-consent-modal` | Modal de consentiment legal (`lib-modal` per dins) |
| `app-splash-screen` | Pantalla de càrrega inicial |
| `app-person-switcher` | Selector de persona gestionada (delegació), a `profile` |
| `app-person-data-fields` | Bloc de 6 camps compartit entre `activate` i `pending-dependents` |

## Patrons de pàgina

### Llista amb doble vista (Agenda)

`event-list`: alterna entre `app-event-feed` (llista infinita amb pull-to-refresh, paginació pròpia) i `app-calendar-view` (graella mensual; cercle per assaig / estrela per actuació, ple i en verd/roig o buit segons si s'ha contestat), mateix `EventService` per darrere de totes dues.

### Detall (Event detail, News detail)

`app-mobile-header` → `lib-card`(s) → seccions condicionals (`@if`) → accions al peu. `event-detail` reutilitza el mateix `app-event-card` que la llista (amb `[showAttendance]="false"` i `[clickable]="false"`) per a la capçalera, en lloc de duplicar el disseny de targeta.

### Confirmació d'assistència

`app-attendance-button`: parella de botons segmentats (`lib-button-group`) Vinc/No vinc, o una `lib-badge` bloquejada quan ja s'ha marcat `ASSISTIT`.

### Kiosk / "Passa llista"

`roll-call` (TECHNICAL/ADMIN, el dia de l'esdeveniment): llista de persones amb cerca (`lib-input`), afegir persona provisional, canvi d'estat per fila (`lib-button-group` de 3 estats). Veure [[DEBT]] F9 per una limitació funcional coneguda (no és cosa de disseny).

### Projecció (pinya)

`segment-projection`: pantalla fullscreen, HUD flotant fosc (`bg-black/60 backdrop-blur-sm`) compartit visualment amb el dashboard (`ProjectionViewComponent`) i amb `libs/pinyes-render` (`own-position-marker`/`own-position-banner`) — deixat en cru a propòsit, és la fase 7.3.5 (canvas) qui l'ha de resoldre, no una pàgina PWA per separat. El propi canvas Konva (`lib-pinya-projection`) està totalment fora de l'abast d'este sistema de disseny fins eixa fase.

## Regles d'estil

1. **`@muixer/ui` primer** — mai un `<button class="btn ...">` a mà si `lib-button` ho pot fer; quan no pot (un gap real d'API), es documenta just al costat del codi, no en silenci.
2. **Cura amb `display: contents`** — cap host `lib-*` és un element real: classes de mida/posició (`shrink-0`, `absolute`, `[style.order]`) sobre el tag `<lib-*>` no fan res; cal una etiqueta embolcalladora real per a eixes. Un atribut estàtic sense reconéixer (`id`, `data-testid`) es duplica al host, no arriba al control real — vore "Component conventions" a [[DESIGN_SYSTEM]].
3. **Icones tipades (`[img]`)**, mai un nom de cadena (`[name]`).
4. **Text en català** — tots els labels, missatges, botons. Vore `.agents/skills/language-rules/`.
5. **Mai `.scss`** tret d'animacions complexes.
6. **TDD estricte** — vore `.agents/skills/test-driven-development/`.

## Routing

| Path | Feature | Guard afegit |
|------|---------|-------|
| `/login`, `/forgot-password`, `/activate` | Autenticació | `alreadyAuthGuard` |
| `/home` | Inici (pròxim esdeveniment, notícies, xicalla pendent) | — |
| `/events` | Agenda (llista/calendari) | — |
| `/events/past` | Esdeveniments passats | — |
| `/events/:id` | Detall d'esdeveniment | — |
| `/events/:id/roll-call` | Passa llista | `rolesGuard(TECHNICAL,ADMIN)` |
| `/events/:eventId/segments/:segmentId` | Projecció d'una pinya | — |
| `/news/:id` | Detall de notícia | — |
| `/profile`, `/profile/settings` | Perfil i configuració | — |
| `/pending-dependents` | Alta de xicalla gestionada | — |

Totes (excepte auth) darrere d'`AppShellComponent` (arrel `''`) amb `authGuard` + `rolesGuard(MEMBER,TECHNICAL,ADMIN)`; totes `lazy` (`loadComponent`).

## Theming per colla

Mateix mecanisme que el dashboard — veure la secció *Theming / dark mode* de [[DESIGN_SYSTEM]]. Sense selector de tema en temps d'execució (com el dashboard).

---

*Veïns: [[DESIGN_SYSTEM]] · [[DASHBOARD_UI]] · [[AUTH_FLOW]] · [[DEBT]] · [[MAP]]*
