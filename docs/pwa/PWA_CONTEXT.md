# PWA MuixerApp — Context Ràpid

> **Propòsit:** Referència condensada de tota la funcionalitat PWA. Adjuntar com a context quan es treballi en qualsevol fase P6.x.  
> **Font de veritat:** [PWA_SPEC.md](PWA_SPEC.md) per al detall complet.

---

## Target

~140 membres actius d'una colla de muixerangues. Android/iOS, 100% mobile-first. Angular PWA (no Ionic, no natiu).

---

## Funcionalitats (P6.0–P6.9)

| Fase | Funcionalitat | Resum |
|------|--------------|-------|
| P6.0 | App Shell | Scaffold, 3 tabs (Inici/Events/Perfil), Docker, PRE deploy |
| P6.1 | Auth bàsic | Login email+password, JWT, silent refresh, guards |
| P6.2 | Events + Assistència | Llista events, Home cards, confirmar/cancel·lar assistència |
| P6.3 | Detall Event | Info completa, segments, figures assignades |
| P6.4 | Gestió Familiar | Person selector, assistència per fills/gestionats |
| P6.5 | Canvas Pinyes | Konva readonly, pinch-zoom, highlight posició pròpia |
| P6.6 | Perfil | Stats d'assistència, logout, configuració |
| P6.7 | TECHNICAL extras | Llista assistents, gestió assistència d'altres |
| P6.8 | Magic-Link | Enllaç temporal (72h, un sol ús) generat per admin |
| P6.9 | Push | Service worker, FCM, notificacions d'events |

---

## Rutes

```
/login                          → LoginComponent
/auth/magic?token=xxx           → MagicLinkComponent
/                               → AppShellComponent (tab bar)
  /home                         → HomeComponent (cards pròxims events)
  /events                       → EventListComponent (filtre + cards)
  /events/:id                   → EventDetailComponent
  /events/:eid/segments/:sid/figures/:iid → FigureViewerComponent (fullscreen)
  /profile                      → ProfileComponent
```

Tab bar: sempre visible excepte en rutes fullscreen (canvas, login).

---

## API — Endpoints `/me/`

| Method | Path | Funció |
|--------|------|--------|
| GET | `/me/events` | Events temporada actual amb assistència pròpia |
| GET | `/me/events/:id` | Detall event (segments visibles, assignació) |
| PUT | `/me/events/:id/attendance` | Upsert assistència (self o managed person) |
| GET | `/me/managed-persons` | Persones gestionades (fills, tutoritzats) |
| GET | `/me/profile/stats` | Estadístiques d'assistència |

Body attendance: `{ personId?: string, status: 'PENDENT' | 'ANIRE' | 'NO_VAIG', notes?: string }`

---

## Rols i Permisos

| Rol | Accés PWA |
|-----|-----------|
| MEMBER | Events propis, assistència pròpia + família, canvas (segments visibles) |
| TECHNICAL | Tot MEMBER + llista assistents, gestió assistència d'altres, tots els segments |
| ADMIN | = TECHNICAL (fins multi-tenant) |

---

## Model de dades clau

**Attendance statuses (PWA):** `PENDENT`, `ANIRE`, `NO_VAIG`  
(ASSISTIT / NO_PRESENTAT reservats per check-in futur, no usables des de PWA)

**PersonGuardian:** relació pare/mare → fill/filla. Permet gestionar assistència de persones al càrrec.

**MagicLinkToken:** token 72h, single-use, hashejat amb bcrypt. Admin genera → comparteix per WhatsApp → membre clica → login automàtic.

---

## Patrons UI

| Patró | Detall |
|-------|--------|
| Layout | Bottom tab bar (56px), content p-4, pb-20 |
| Cards | Full-width, border-l-4 (primary=actuació, secondary=assaig), shadow-sm |
| Loading | Skeleton cards (animate-pulse), mai spinners |
| Feedback | Toast (3s success, 5s error), optimistic UI per attendance |
| Touch | Pull-to-refresh (llistes), pinch-zoom (canvas), swipe (figures) |
| Tap targets | Mínim 44×44px |
| Safe areas | `viewport-fit=cover` + `env(safe-area-inset-*)` |

---

## Stack Tècnic

| Capa | Tecnologia |
|------|-----------|
| Framework | Angular 21 (standalone, signals, OnPush) |
| Estils | Tailwind v3 + DaisyUI v4 (tema `colla-barcelona`) |
| Icones | Lucide Angular |
| Font | Inter (Google Fonts) |
| Canvas | Konva (imperatiu, mode readonly) |
| HTTP | `HttpClient` + interceptor (Bearer + 401 retry) |
| Estat | Signals (`signal`, `computed`). Zero RxJS per estat local |
| Auth | JWT memory + httpOnly refresh cookie (7d TTL) |
| Testing | Vitest (unit), Playwright (e2e futur) |
| Build | Nx workspace, lazy-loaded routes |

---

## Deployment

| Entorn | Accés | Base href |
|--------|-------|-----------|
| Dev | `localhost:4300` (proxy → :3000) | `/` |
| PRE | `<IP>/app/` via Dashboard Caddy gateway | `/app/` |
| Prod (futur) | `app.muixeranga.cat` | `/` |

Docker: Caddy alpine (multi-stage build). Dashboard Caddy fa de reverse proxy gateway amb `handle_path /app/*`.

---

## Diferenciació Event Cards

| | Assaig | Actuació |
|--|--------|----------|
| Títol | Data formatada ("Dilluns 16 de juny") | Títol event |
| Subtítol | "Assaig" | Data formatada |
| Accent | `border-secondary` | `border-primary` |

---

## Regles de Negoci

- Un membre només pot canviar la seva assistència (o la dels seus gestionats)
- No es pot canviar assistència d'events passats
- MEMBER veu només segments amb `isVisible: true`
- Canvas: posició pròpia amb highlight pulsant + nodes sense entrada amb vora taronja (assaig only)
- Magic-link: un sol ús, 72h TTL, revocable per admin
- User sense Person vinculada: login funciona però features bloquejades

---

## Convencions

- **Codi:** Anglès (variables, funcions, endpoints, commits)
- **UI:** Català (textos, botons, missatges d'error)
- **Components:** Standalone + OnPush + Signals
- **Imports:** `@muixer/shared` per enums/interfaces compartits
- **Fitxers:** kebab-case, 2 fitxers preferits (.ts + .html inline per petits)
