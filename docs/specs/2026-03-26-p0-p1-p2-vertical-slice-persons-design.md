# P0+P1+P2 — Vertical Slice: Persons

**Date:** 2026-03-26
**Status:** Approved
**Approach:** Vertical Slice (Approach C)
**Scope:** Scaffold Nx monorepo + Person/Position/User entities + Legacy data import + Dashboard person list view
**Note:** This covers the data model portion of P1 (entities + pre-registration). The full auth flow (login, JWT, guards) is a separate follow-up step.

---

## 1. Context

MuixerApp is an open-source attendance and figure management system for muixerangues (Valencian human tower groups). This is the first implementation block: scaffold the project, implement the Person vertical slice end-to-end, and import real data from the legacy APPsistència system.

### Decisions Already Made

| Decision | Choice |
|----------|--------|
| Backend | NestJS (TypeScript strict) |
| Frontend | Angular 20+ (standalone components, signals, OnPush) |
| Mobile | Angular PWA (no Ionic) |
| Database | PostgreSQL on NeonDB (remote, no local DB) |
| ORM | TypeORM (class-based entities with decorators) |
| Monorepo | Nx |
| Docker | No (direct local development) |
| Auth flow | Pre-register bulk (existing members) + invite link (new members) |
| Language | Catalan UI, English code |

### Terminology

- **Membre** (member): gender-neutral term for any person in the colla. Never "casteller" (that's a different tradition). In English code: `Person`, `Member`.
- **Colla**: the muixeranga group. Initially Muixeranga de Barcelona only, multi-colla support planned for future.
- **Xicalla**: children (under 16). Never "canalla" in this codebase.

---

## 2. Nx Monorepo Structure

```
muixer-app/
├── apps/
│   ├── api/                          ← NestJS backend
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── person/
│   │       │   │   ├── person.entity.ts
│   │       │   │   ├── person.controller.ts
│   │       │   │   ├── person.service.ts
│   │       │   │   ├── person.module.ts
│   │       │   │   └── dto/
│   │       │   │       ├── create-person.dto.ts
│   │       │   │       ├── update-person.dto.ts
│   │       │   │       └── person-filter.dto.ts
│   │       │   ├── position/
│   │       │   │   ├── position.entity.ts
│   │       │   │   ├── position.controller.ts
│   │       │   │   ├── position.service.ts
│   │       │   │   └── position.module.ts
│   │       │   └── database/
│   │       │       ├── database.module.ts
│   │       │       └── seeds/
│   │       │           ├── seed.command.ts
│   │       │           └── seed.module.ts
│   │       ├── app.module.ts
│   │       └── main.ts
│   │
│   ├── dashboard/                    ← Angular admin web
│   │   └── src/app/
│   │       ├── features/
│   │       │   └── persons/
│   │       │       ├── persons.routes.ts
│   │       │       ├── components/
│   │       │       │   ├── person-list/
│   │       │       │   └── person-detail/
│   │       │       └── services/
│   │       │           └── person.service.ts
│   │       ├── core/
│   │       │   └── services/
│   │       │       └── api.service.ts
│   │       ├── shared/
│   │       │   └── components/
│   │       │       └── layout/
│   │       │           ├── sidebar/
│   │       │           └── header/
│   │       ├── app.component.ts
│   │       ├── app.config.ts
│   │       └── app.routes.ts
│   │
│   └── pwa/                          ← Angular PWA (scaffold only, empty)
│
├── libs/
│   └── shared/
│       └── src/
│           ├── dto/
│           ├── interfaces/
│           └── enums/
│               ├── user-role.enum.ts
│               ├── gender.enum.ts
│               ├── availability-status.enum.ts
│               ├── onboarding-status.enum.ts
│               └── figure-zone.enum.ts
│
├── scripts/
│   └── appsistencia_extractor.py     ← existing
├── data/extracted/                    ← output from extractor
├── docs/
│   └── specs/                        ← this document
└── nx.json
```

Key points:
- `apps/pwa/` is an empty scaffold — not touched until P5
- `libs/shared/` contains enums and interfaces consumed by both api and dashboard
- TypeORM entities live in `apps/api/`; shared interfaces live in `libs/shared/`
- The Python extractor stays as-is; the importer is a NestJS CLI command

---

## 3. Data Model

### Enums (libs/shared)

```typescript
enum UserRole {
  ADMIN = 'ADMIN',
  TECHNICAL = 'TECHNICAL',
  MEMBER = 'MEMBER',
}

enum Gender {
  MALE = 'MALE',
  FEMALE = 'FEMALE',
  OTHER = 'OTHER',
}

enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
  LONG_TERM_UNAVAILABLE = 'LONG_TERM_UNAVAILABLE',
}

enum OnboardingStatus {
  COMPLETED = 'COMPLETED',
  IN_PROGRESS = 'IN_PROGRESS',
  LOST = 'LOST',
  NOT_APPLICABLE = 'NOT_APPLICABLE',
}

enum FigureZone {
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  FIGURE_DIRECTION = 'FIGURE_DIRECTION',
  XICALLA_DIRECTION = 'XICALLA_DIRECTION',
}
```

### Entity: Person

```typescript
@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  firstSurname: string;

  @Column({ nullable: true })
  secondSurname: string | null;

  @Column({ length: 20, unique: true })
  alias: string;                     // Primary identifier in figures. NOT NULL, unique, max 20 chars.

  @Column({ nullable: true })
  email: string | null;              // Single source of truth for email (not duplicated on User)

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'int', nullable: true })
  shoulderHeight: number | null;     // cm

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ default: false })
  isXicalla: boolean;                // Explicit boolean — birthDate may not be available at registration

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isMember: boolean;                 // Soci/sòcia of the entity

  @Column({ type: 'enum', enum: AvailabilityStatus, default: 'AVAILABLE' })
  availability: AvailabilityStatus;  // Covers injury, pregnancy, any reason they can't participate in figures

  @Column({ type: 'enum', enum: OnboardingStatus, default: 'NOT_APPLICABLE' })
  onboardingStatus: OnboardingStatus;

  @Column({ nullable: true })
  notes: string | null;

  @Column({ type: 'date', nullable: true })
  shirtDate: Date | null;

  @Column({ type: 'date', nullable: true })
  joinDate: Date | null;

  @Column({ nullable: true })
  legacyId: string | null;          // Original ID from APPsistència for migration traceability

  @ManyToMany(() => Position)
  @JoinTable({ name: 'person_positions' })
  positions: Position[];             // M:N — a person can have multiple positions

  @ManyToOne(() => User, user => user.managedPersons, { nullable: true })
  managedBy: User | null;           // Who manages this profile (self, parent, partner)

  @Column({ default: true })
  isMainAccount: boolean;           // true = "this is me", false = "I manage this person"

  @ManyToOne(() => Person, { nullable: true })
  mentor: Person | null;            // Padrí/padrina for newcomers

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Entity: Position

```typescript
@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;                     // "Primeres", "Vents", "Laterals"...

  @Column({ unique: true })
  slug: string;                     // "primeres", "vents", "laterals"

  @Column({ nullable: true })
  shortDescription: string | null;

  @Column({ nullable: true })
  longDescription: string | null;

  @Column({ nullable: true })
  color: string | null;             // Hex color for visual representation

  @Column({ type: 'enum', enum: FigureZone, nullable: true })
  zone: FigureZone | null;          // PINYA, TRONC, FIGURE_DIRECTION, XICALLA_DIRECTION, or null
}
```

### Entity: User

```typescript
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  passwordHash: string;             // bcrypt cost 12+

  @Column({ type: 'enum', enum: UserRole, default: 'MEMBER' })
  role: UserRole;

  @Column({ default: false })
  isActive: boolean;                // Activated when user claims their account

  @Column({ nullable: true })
  inviteToken: string | null;       // For pre-register and invite link flows

  @Column({ nullable: true })
  inviteExpiresAt: Date | null;

  @Column({ nullable: true })
  resetToken: string | null;        // For assisted password recovery

  @Column({ nullable: true })
  resetExpiresAt: Date | null;

  @OneToMany(() => Person, person => person.managedBy)
  managedPersons: Person[];         // One user manages N persons (self + children + partner)

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### Entity Relationship Summary

```
User (1) ──── manages ────> (N) Person
Person (N) <── positions ──> (N) Position   [junction: person_positions]
Person (N) ──── mentor ────> (1) Person     [self-referencing, nullable]
```

### Future: Colla Entity (NOT in this slice)

Multi-colla support is planned. When implemented, a `Colla` entity will be added with:
- name, slug, logo, primary/secondary colors
- Person will get a `collaId` foreign key
- Dashboard theming will be driven by Colla colors
- For now, the dashboard uses CSS custom properties ready for this future binding

---

## 4. Backend API

### NeonDB Connection

```typescript
TypeOrmModule.forRootAsync({
  useFactory: () => ({
    type: 'postgres',
    url: process.env.DATABASE_URL,   // NeonDB connection string
    ssl: { rejectUnauthorized: false },
    entities: [Person, Position, User],
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV !== 'production',
  }),
})
```

`synchronize: true` in dev for rapid iteration. Migrations for production (future).

### Person Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET /api/persons` | List with filters and pagination |
| `GET /api/persons/:id` | Detail with positions loaded |
| `POST /api/persons` | Create person |
| `PATCH /api/persons/:id` | Update person |
| `DELETE /api/persons/:id` | Soft delete (isActive = false) |
| ~~`GET /api/persons/search?q=`~~ | Removed: use `search` filter on `GET /api/persons` instead |

### Filters (GET /api/persons)

```typescript
class PersonFilterDto {
  search?: string;                    // alias, name, surname
  positionId?: string;
  availability?: AvailabilityStatus;
  isActive?: boolean;
  isXicalla?: boolean;
  isMember?: boolean;
  page?: number;                      // default 1
  limit?: number;                     // default 50, max 100
}
```

### Position Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| `GET /api/positions` | All positions (no pagination, ~12-15 records) |
| `POST /api/positions` | Create position (admin only) |
| `PATCH /api/positions/:id` | Update position |

### Validation

All DTOs use `class-validator`. Key rules:
- `alias`: string, min 1, max 20, required
- `shoulderHeight`: int, min 50, max 250, optional
- `email`: valid email format, optional
- `positionIds`: array of UUIDs, optional

### Error Handling

Standard NestJS exception filters. API responses follow:
```typescript
// Success
{ data: T, meta?: { total, page, limit } }

// Error
{ statusCode: number, message: string, error: string }
```

---

## 5. Data Import (Legacy → NeonDB)

### Prerequisites

1. Run the Python extractor: `python scripts/appsistencia_extractor.py`
2. Verify `data/extracted/castellers.json` exists (258 records)

### Import Command

NestJS CLI command via `nest-commander`:

```bash
nx run api:seed
```

### Import Flow

```
1. Read data/extracted/castellers.json
       │
2. Extract unique positions from all persons
   Split combined positions: "PRIMERES + VENTS" → ["Primeres", "Vents"]
       │
3. Upsert Position records (with zone mapping)
       │
4. For each person:
   a) Map legacy fields → Person entity
   b) Associate positions (M:N)
   c) If has email → create inactive User with inviteToken
   d) Map tecnica field → User.role
       │
5. Print summary report
```

### Position Mapping (Legacy → New)

| Legacy Value | New Name | Slug | Zone |
|---|---|---|---|
| PRIMERES | Primeres | primeres | TRONC |
| VENTS | Vents | vents | PINYA |
| LATERALS | Laterals | laterals | PINYA |
| CONTRAFORTS | Contraforts | contraforts | PINYA |
| 2NS LATERALS | Segons Laterals | segons-laterals | PINYA |
| CROSSES | Crosses | crosses | PINYA |
| CANALLA (legacy) | Xicalla | xicalla | null |
| NENS COLLA | Nens Colla | nens-colla | null |
| ACOMPANYANTS | Acompanyants | acompanyants | null |
| ALTRES | Altres | altres | null |
| NOVATOS | Novatos | novatos | null |
| IMATGE I PARADETA | Imatge i Paradeta | imatge-paradeta | null |

Note: Zone assignments are initial estimates. Configurable via the seed data or admin UI.

### Person Field Mapping

| Legacy | New | Transform |
|--------|-----|-----------|
| `id` | `legacyId` | Keep for traceability |
| `nom` | `name` | Direct |
| `cognom1` | `firstSurname` | Direct |
| `cognom2` | `secondSurname` | Direct (nullable) |
| `mote` | `alias` | Fallback to `nom` if empty, truncated to 20 chars |
| `email` | `email` | Direct |
| `data_naixement` | `birthDate` | Parse DD/MM/YYYY → Date |
| `telefon` | `phone` | Direct |
| `alcada_espatlles` | `shoulderHeight` | Parse string → int |
| `posicio` | `positions[]` | Split by " + " → M:N |
| `propi` | `isActive` | "Sí" → true |
| `lesionat` | `availability` | "Sí" → TEMPORARILY_UNAVAILABLE |
| `estat_acollida` | `onboardingStatus` | Map Catalan → enum |
| `instant_camisa` | `shirtDate` | Parse DD/MM/YYYY → Date |
| `observacions` | `notes` | Direct |
| `tecnica` | `User.role` | "No"→MEMBER, "Administrador"→ADMIN, "Tècnica/Junta"→TECHNICAL |
| `te_app` | — | Discarded |
| `revisat` | — | Discarded |
| `import_quota` | — | Discarded |
| `llistes` | — | Discarded (derivable) |
| `n_assistencies` | — | Discarded (will be computed) |

### Idempotency

The importer uses `legacyId` for upsert detection. Safe to run multiple times.

### isXicalla derivation during import

```typescript
isXicalla: ['CANALLA', 'NENS COLLA'].some(p => raw.posicio?.toUpperCase().includes(p))
```

---

## 6. Dashboard Angular

### Theming (Multi-colla Ready)

CSS custom properties on `:root`, ready to be overridden per colla in the future:

```css
:root {
  --colla-primary: #1B5E20;        /* Muixeranga de Barcelona green */
  --colla-secondary: #FDD835;      /* Yellow accent */
  --colla-text-on-primary: #FFFFFF;
  --colla-logo-url: url('/assets/logo-mxb.svg');
}
```

All dashboard components use these variables instead of hardcoded colors. When multi-colla lands, the API will provide the colla's palette and the app will override the CSS variables at runtime.

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  [Logo] MuixerApp                         [Avatar/Menu]  │
├────────┬─────────────────────────────────────────────────┤
│        │                                                 │
│ Sidebar│  [Active feature content via router-outlet]     │
│        │                                                 │
│ 👥 Per-│                                                 │
│  sones │                                                 │
│  (actiu│                                                 │
│        │                                                 │
│ 📅 Esde│                                                 │
│  venim.│                                                 │
│  (gris)│                                                 │
│        │                                                 │
│ 📊 Rep.│                                                 │
│  (gris)│                                                 │
│        │                                                 │
└────────┴─────────────────────────────────────────────────┘
```

Sidebar shows all planned sections. Only "Persones" is active. Others are greyed out (visual roadmap for the team).

### Person List View

- Spartan UI table (CDK-based) with Spartan pagination and CDK sort directives
- Reactive search (signal-based, debounce 300ms) by alias/name/surname
- Combinable filters: position, availability, active, xicalla, member
- Position badges with colors from Position.color (Spartan Badge + Tailwind)
- Responsive: table on desktop (>=lg), cards on mobile (<lg)
- All UI text in Catalan

### Tech Approach

- Standalone components with `ChangeDetectionStrategy.OnPush`
- Signals for state management (no RxJS stores needed for this slice)
- Lazy-loaded feature routes
- `HttpClient` calling `localhost:3000/api/*` in dev

### Routing

```typescript
export const routes: Routes = [
  { path: '', redirectTo: 'persons', pathMatch: 'full' },
  {
    path: 'persons',
    loadChildren: () => import('./features/persons/persons.routes'),
  },
];
```

---

## 7. What Is NOT In This Slice

Explicitly out of scope for P0+P1+P2:

- Authentication / login screen (User entity exists for pre-registration, but login/JWT/guards are a follow-up step)
- Login mechanism: when implemented, User will authenticate via Person.email + password (email lives on Person, not User)
- Events, attendance, seasons
- Figures / canvas module
- PWA functionality
- Notifications
- WebSocket / real-time updates
- Production deployment
- Colla entity (multi-tenant)

These are tracked in `PROJECT_ROADMAP.md` for future sub-projects.

---

## 8. Success Criteria

The vertical slice is complete when:

1. `nx serve api` starts the NestJS backend connected to NeonDB
2. `nx serve dashboard` starts the Angular dashboard
3. `nx run api:seed` imports 258 real persons from extracted JSON
4. `GET /api/persons` returns paginated, filterable person data
5. The dashboard shows a person list with real imported data
6. Positions are displayed with colors as badges
7. Search and filters work reactively
8. All UI text is in Catalan, all code is in English
