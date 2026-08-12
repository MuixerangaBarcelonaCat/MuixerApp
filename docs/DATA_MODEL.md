---
tags: [domini]
---

# Model de dades

> La secció **Entitats** es genera des de les entitats TypeORM amb `pnpm run docs:model`.
> Si un camp no quadra amb el codi, no l'arregles ací: arregla l'entitat i torna a generar.
> Les parts escrites a mà (relacions, invariants, notes) queden fora dels marcadors AUTO.

Font de veritat del codi: `apps/api/src/modules/**/*.entity.ts`, registrades a
`apps/api/src/modules/database/entities.ts`. Migracions a `apps/api/src/migrations/`
(`synchronize: false`).

---

## Relacions

**Usuaris i persones**

```
User ──1:1──? Person                  : un User pot tenir 0 o 1 Person vinculada
Person ──< Person (mentor)            : autoreferència (mentor / aprenent)
Person >──< Tag                       : via person_positions (M:N)
User ──< RefreshToken                 : N tokens actius per usuari
User >──< Person (person_delegates)   : delegació d'assistència (unique user + person)
```

**Events i assistència**

```
Season ──< Event                      : temporada → events
Event ──< Attendance                  : unique (person, event)
Event ──< EventSegment                : CASCADE
```

**Figures**

```
FigureTemplate ──< FigureNode          : CASCADE (totes les zones al mateix lloc)
FigureTemplate ──< Rengla              : cordons de pinya
Composition ──< CompositionEntry       : CASCADE
CompositionEntry >── FigureTemplate    : M:1 (esborrar el template dona 409 si està en ús)

EventSegment ──< FigureInstance        : CASCADE
FigureInstance >──? FigureTemplate     : M:1 opcional ─┐ XOR
FigureInstance >──? Composition        : M:1 opcional ─┘
FigureInstance ──< InstanceNode         : CASCADE (snapshot lazy)
FigureInstance ──< NodeAssignment       : CASCADE
NodeAssignment >── InstanceNode         : M:1 RESTRICT (mai a FigureNode)
NodeAssignment >── Person               : M:1 RESTRICT
NodeAssignment >── EventSegment         : FK denormalitzada per validar unicitat per segment
```

---

## Invariants

1. **Soft delete** = `isActive: boolean` (a `Person`, `Tag`, `PersonDelegate`…). No s'usa
   `@DeleteDateColumn`.
2. **Snapshot lazy**: una `FigureInstance` és lleugera fins a la primera assignació; llavors es copien els
   `FigureNode` a `InstanceNode` i `snapshotted = true`. Els canvis posteriors al template no l'afecten.
3. **`NodeAssignment` apunta sempre a `InstanceNode`**, mai a `FigureNode`.
4. **`FigureInstance` té `figureTemplate` o `composition`**, mai les dues (XOR).
5. **Unicitat d'assignacions:** un node només pot tenir una persona (`figureInstance + instanceNode`), una
   persona no pot repetir-se dins d'una instància (`figureInstance + person`) ni dins d'un segment
   (`segment + person`).
6. **IDs de node estables**: el `PUT` de templates fa upsert per ID (crea, actualitza, esborra els absents);
   `FigureNode.id` no canvia entre saves. `originNodeId` traça el llinatge en duplicar.
7. **Zona BASE**: els nodes amb `zone = BASE` (z=0) surten tant a la vista de pinya com al tronc.
8. **Protecció referencial**: no es pot esborrar un `FigureTemplate` amb `CompositionEntry`s o
   `FigureInstance`s (409).
9. **Traçabilitat del legacy**: `legacyId` + `lastSyncedAt` a `Person` (vegeu [[SYNC_ARCHITECTURE]]).
10. **Alçada relativa**: al tronc, si la persona té `shoulderHeight`, es mostra la diferència respecte al
    baseline de 140 cm ("+3" / "-5").

---

## Entitats

<!-- BEGIN:AUTO — generat per scripts/generate-data-model.mjs, no editar a mà -->

> Generat el 2026-08-10 des de les entitats TypeORM amb `pnpm run docs:model`.
> **19 entitats.** No editar a mà: canvia l'entitat i torna a executar l'script.

### Resum

| Taula | Entitat | Camps |
|-------|---------|------:|
| `attendances` | `Attendance` | 10 |
| `audit_logs` | `AuditLog` | 8 |
| `composition_entries` | `CompositionEntry` | 13 |
| `compositions` | `Composition` | 6 |
| `event_segments` | `EventSegment` | 11 |
| `events` | `Event` | 20 |
| `figure_instances` | `FigureInstance` | 21 |
| `figure_nodes` | `FigureNode` | 22 |
| `figure_templates` | `FigureTemplate` | 11 |
| `instance_nodes` | `InstanceNode` | 25 |
| `legal_documents` | `LegalDocument` | 9 |
| `node_assignments` | `NodeAssignment` | 7 |
| `person_delegates` | `PersonDelegate` | 8 |
| `persons` | `Person` | 26 |
| `positions` | `Tag` | 9 |
| `refresh_tokens` | `RefreshToken` | 10 |
| `rengles` | `Rengla` | 5 |
| `seasons` | `Season` | 9 |
| `users` | `User` | 14 |

### Enums (`libs/shared/src/enums`)

| Enum | Valors |
|------|--------|
| `AttendanceStatus` | `PENDENT` · `ANIRE` · `NO_VAIG` · `ASSISTIT` |
| `AuditAction` | `CONSENT_ACCEPTED` · `SENSITIVE_DATA_ACCESS` · `SENSITIVE_DATA_EXPORT` |
| `AvailabilityStatus` | `AVAILABLE` · `TEMPORARILY_UNAVAILABLE` · `LONG_TERM_UNAVAILABLE` |
| `ClientType` | `dashboard` · `pwa` |
| `DelegateType` | `PARENT` · `PARTNER` · `GUARDIAN` · `OTHER` |
| `EventType` | `ASSAIG` · `ACTUACIO` |
| `FigureMode` | `COMPLETA` · `PEU` · `REMAT` · `NETA` |
| `FigureZone` | `BASE` · `PINYA` · `TRONC` · `FIGURE_DIRECTION` · `XICALLA_DIRECTION` · `DECORATION` |
| `Gender` | `MALE` · `FEMALE` · `OTHER` |
| `LegalDocumentType` | `PRIVACY_POLICY` · `TRANSPARENCY_CLAUSE` |
| `NodeShape` | `ELLIPSE` · `RECTANGLE` · `ARROW` · `CIRCLE` |
| `OnboardingStatus` | `COMPLETED` · `IN_PROGRESS` · `LOST` · `NOT_APPLICABLE` |
| `SegmentMoveConflictResolution` | `KEEP_TARGET` · `KEEP_MOVED` |
| `UserRole` | `ADMIN` · `TECHNICAL` · `MEMBER` |

### `attendances` — `Attendance`

Definició: [`apps/api/src/modules/event/attendance.entity.ts`](../apps/api/src/modules/event/attendance.entity.ts)

**Unique:** `person + event`

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `status` | `enum` | `AttendanceStatus` | no | enum `AttendanceStatus` |
| `respondedAt` | `timestamptz` | `Date` | sí | — |
| `notes` | `text` | `string` | sí | — |
| `person` | `relation` | `Person` | no | ManyToOne → `Person` |
| `event` | `relation` | `Event` | no | ManyToOne → `Event` |
| `legacyId` | `varchar` | `string` | sí | — |
| `lastSyncedAt` | `timestamptz` | `Date` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `audit_logs` — `AuditLog`

Definició: [`apps/api/src/modules/audit/audit-log.entity.ts`](../apps/api/src/modules/audit/audit-log.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `actorUserId` | `uuid` | `string` | sí | — |
| `action` | `enum` | `AuditAction` | no | enum `AuditAction` |
| `targetType` | `varchar` | `string` | sí | — |
| `targetId` | `uuid` | `string` | sí | — |
| `metadata` | `jsonb` | `Record<string, unknown>` | sí | — |
| `ipAddress` | `varchar` | `string` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |

### `composition_entries` — `CompositionEntry`

Definició: [`apps/api/src/modules/composition/entities/composition-entry.entity.ts`](../apps/api/src/modules/composition/entities/composition-entry.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `composition` | `relation` | `Composition` | no | ManyToOne → `Composition`, onDelete CASCADE |
| `figureTemplate` | `relation` | `FigureTemplate` | no | ManyToOne → `FigureTemplate`, onDelete RESTRICT |
| `label` | `varchar` | `string` | sí | — |
| `offsetX` | `float` | `number` | no | default `0` |
| `offsetY` | `float` | `number` | no | default `0` |
| `angle` | `float` | `number` | no | default `0` |
| `troncPanelX` | `float` | `number` | sí | — |
| `troncPanelY` | `float` | `number` | sí | — |
| `figureMode` | `enum` | `FigureMode` | no | enum `FigureMode`, default `FigureMode.COMPLETA` |
| `numberOfCordons` | `int` | `number` | sí | — |
| `cordonsObertsEnabled` | `boolean` | `boolean` | no | default `true` |
| `sortOrder` | `int` | `number` | no | default `0` |

### `compositions` — `Composition`

Definició: [`apps/api/src/modules/composition/entities/composition.entity.ts`](../apps/api/src/modules/composition/entities/composition.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `name` | `varchar` | `string` | no | — |
| `description` | `text` | `string` | sí | — |
| `entries` | `relation` | `CompositionEntry[]` | no | OneToMany → `CompositionEntry` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `event_segments` — `EventSegment`

Definició: [`apps/api/src/modules/event-segment/entities/event-segment.entity.ts`](../apps/api/src/modules/event-segment/entities/event-segment.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `event` | `relation` | `Event` | no | ManyToOne → `Event`, onDelete CASCADE |
| `name` | `varchar` | `string` | sí | — |
| `sortOrder` | `int` | `number` | no | — |
| `startTime` | `varchar` | `string` | sí | — |
| `endTime` | `varchar` | `string` | sí | — |
| `notes` | `text` | `string` | sí | — |
| `isVisible` | `boolean` | `boolean` | no | default `false` |
| `instances` | `relation` | `FigureInstance[]` | no | OneToMany → `FigureInstance` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `events` — `Event`

Definició: [`apps/api/src/modules/event/event.entity.ts`](../apps/api/src/modules/event/event.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `eventType` | `enum` | `EventType` | no | enum `EventType` |
| `title` | `varchar` | `string` | no | — |
| `description` | `text` | `string` | sí | — |
| `date` | `date` | `Date` | no | — |
| `startTime` | `varchar` | `string` | sí | — |
| `location` | `varchar` | `string` | sí | — |
| `locationUrl` | `varchar` | `string` | sí | — |
| `information` | `text` | `string` | sí | — |
| `countsForStatistics` | `—` | `boolean` | no | default `true` |
| `metadata` | `jsonb` | `RehearsalMetadata \| PerformanceMetadata` | no | — |
| `attendanceSummary` | `jsonb` | `AttendanceSummary` | no | default `DEFAULT_ATTENDANCE_SUMMARY` |
| `season` | `relation` | `Season` | sí | ManyToOne → `Season` |
| `attendances` | `relation` | `Attendance[]` | no | OneToMany → `Attendance` |
| `segments` | `relation` | `EventSegment[]` | no | OneToMany → `EventSegment` |
| `legacyId` | `varchar` | `string` | sí | unique |
| `legacyType` | `varchar` | `string` | sí | — |
| `lastSyncedAt` | `timestamptz` | `Date` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `figure_instances` — `FigureInstance`

Definició: [`apps/api/src/modules/event-segment/entities/figure-instance.entity.ts`](../apps/api/src/modules/event-segment/entities/figure-instance.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `segment` | `relation` | `EventSegment` | no | ManyToOne → `EventSegment`, onDelete CASCADE |
| `figureTemplate` | `relation` | `FigureTemplate` | sí | ManyToOne → `FigureTemplate`, onDelete RESTRICT |
| `label` | `varchar` | `string` | sí | — |
| `sortOrder` | `int` | `number` | no | — |
| `figureMode` | `enum` | `FigureMode` | no | enum `FigureMode`, default `FigureMode.COMPLETA` |
| `snapshotted` | `boolean` | `boolean` | no | default `false` |
| `numberOfCordons` | `int` | `number` | sí | — |
| `cordonsObertsEnabled` | `boolean` | `boolean` | no | default `true` |
| `projectionX` | `float` | `number` | sí | — |
| `projectionY` | `float` | `number` | sí | — |
| `projectionScale` | `float` | `number` | no | default `1.0` |
| `projectionAngle` | `float` | `number` | sí | — |
| `troncPanelX` | `float` | `number` | sí | — |
| `troncPanelY` | `float` | `number` | sí | — |
| `troncPanelWidth` | `float` | `number` | sí | — |
| `troncPanelHeight` | `float` | `number` | sí | — |
| `instanceNodes` | `relation` | `InstanceNode[]` | no | OneToMany → `node` |
| `assignments` | `relation` | `NodeAssignment[]` | no | OneToMany → `a` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `figure_nodes` — `FigureNode`

Definició: [`apps/api/src/modules/figure/entities/figure-node.entity.ts`](../apps/api/src/modules/figure/entities/figure-node.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `template` | `relation` | `FigureTemplate` | no | ManyToOne → `FigureTemplate` |
| `label` | `varchar` | `string` | no | — |
| `zone` | `enum` | `FigureZone` | no | enum `FigureZone` |
| `positionType` | `varchar` | `string` | sí | — |
| `x` | `float` | `number` | no | — |
| `y` | `float` | `number` | no | — |
| `z` | `int` | `number` | no | default `0` |
| `width` | `float` | `number` | no | — |
| `height` | `float` | `number` | no | — |
| `rotation` | `float` | `number` | no | default `0` |
| `color` | `varchar` | `string` | sí | — |
| `shape` | `enum` | `NodeShape` | no | enum `NodeShape` |
| `sortOrder` | `int` | `number` | no | default `0` |
| `climbIndicator` | `varchar` | `string` | sí | — |
| `ringLevel` | `int` | `number` | sí | — |
| `originNodeId` | `uuid` | `string` | sí | — |
| `renglaId` | `uuid` | `string` | sí | — |
| `renglaPosition` | `int` | `number` | sí | — |
| `metadata` | `jsonb` | `Record<string, unknown>` | no | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `figure_templates` — `FigureTemplate`

Definició: [`apps/api/src/modules/figure/entities/figure-template.entity.ts`](../apps/api/src/modules/figure/entities/figure-template.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `name` | `varchar` | `string` | no | unique |
| `slug` | `varchar` | `string` | no | unique |
| `description` | `text` | `string` | sí | — |
| `direction` | `float` | `number` | no | default `0` |
| `metadata` | `jsonb` | `Record<string, unknown>` | no | — |
| `nodes` | `relation` | `FigureNode[]` | no | OneToMany → `FigureNode` |
| `rengles` | `relation` | `Rengla[]` | no | OneToMany → `Rengla` |
| `instances` | `relation` | `FigureInstance[]` | no | OneToMany → `FigureInstance` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `instance_nodes` — `InstanceNode`

Definició: [`apps/api/src/modules/event-segment/entities/instance-node.entity.ts`](../apps/api/src/modules/event-segment/entities/instance-node.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `figureInstance` | `relation` | `FigureInstance` | no | ManyToOne → `instance` |
| `sourceNodeId` | `uuid` | `string` | sí | — |
| `originNodeId` | `uuid` | `string` | sí | — |
| `label` | `varchar` | `string` | no | — |
| `zone` | `enum` | `FigureZone` | no | enum `FigureZone` |
| `positionType` | `varchar` | `string` | sí | — |
| `x` | `float` | `number` | no | — |
| `y` | `float` | `number` | no | — |
| `z` | `int` | `number` | no | default `0` |
| `width` | `float` | `number` | no | — |
| `height` | `float` | `number` | no | — |
| `rotation` | `float` | `number` | no | default `0` |
| `color` | `varchar` | `string` | sí | — |
| `shape` | `enum` | `NodeShape` | no | enum `NodeShape` |
| `sortOrder` | `int` | `number` | no | default `0` |
| `climbIndicator` | `varchar` | `string` | sí | — |
| `ringLevel` | `int` | `number` | sí | — |
| `renglaId` | `uuid` | `string` | sí | — |
| `renglaPosition` | `int` | `number` | sí | — |
| `metadata` | `jsonb` | `Record<string, unknown>` | no | — |
| `isAdHoc` | `boolean` | `boolean` | no | default `false` |
| `createdBy` | `relation` | `User` | sí | ManyToOne → `undefined`, onDelete SET NULL |
| `createdById` | `uuid` | `string` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |

### `legal_documents` — `LegalDocument`

Definició: [`apps/api/src/modules/legal/legal-document.entity.ts`](../apps/api/src/modules/legal/legal-document.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `type` | `enum` | `LegalDocumentType` | no | enum `LegalDocumentType` |
| `version` | `int` | `number` | no | — |
| `content` | `text` | `string` | no | — |
| `isActive` | `boolean` | `boolean` | no | default `false` |
| `requiresConsent` | `boolean` | `boolean` | no | default `false` |
| `publishedAt` | `timestamptz` | `Date` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `node_assignments` — `NodeAssignment`

Definició: [`apps/api/src/modules/node-assignment/entities/node-assignment.entity.ts`](../apps/api/src/modules/node-assignment/entities/node-assignment.entity.ts)

**Unique:** `figureInstance + instanceNode` · `figureInstance + person` · `segment + person`

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `figureInstance` | `relation` | `FigureInstance` | no | ManyToOne → `FigureInstance` |
| `instanceNode` | `relation` | `InstanceNode` | no | ManyToOne → `InstanceNode`, onDelete RESTRICT |
| `person` | `relation` | `Person` | no | ManyToOne → `Person`, onDelete RESTRICT |
| `segment` | `relation` | `EventSegment` | no | ManyToOne → `EventSegment`, onDelete CASCADE |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `person_delegates` — `PersonDelegate`

Definició: [`apps/api/src/modules/person-delegate/person-delegate.entity.ts`](../apps/api/src/modules/person-delegate/person-delegate.entity.ts)

**Unique:** `user + person`

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `user` | `relation` | `User` | no | ManyToOne → `User` |
| `person` | `relation` | `Person` | no | ManyToOne → `Person` |
| `delegateType` | `enum` | `DelegateType` | no | enum `DelegateType` |
| `isActive` | `boolean` | `boolean` | no | default `true` |
| `isPrimary` | `boolean` | `boolean` | no | default `false` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `persons` — `Person`

Definició: [`apps/api/src/modules/person/person.entity.ts`](../apps/api/src/modules/person/person.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `name` | `varchar` | `string` | no | — |
| `firstSurname` | `varchar` | `string` | no | — |
| `secondSurname` | `varchar` | `string` | sí | — |
| `alias` | `varchar` | `string` | no | unique |
| `phone` | `varchar` | `string` | sí | — |
| `birthDate` | `date` | `Date` | sí | — |
| `shoulderHeight` | `int` | `number` | sí | — |
| `gender` | `enum` | `Gender` | sí | enum `Gender` |
| `isXicalla` | `boolean` | `boolean` | no | default `false` |
| `isActive` | `boolean` | `boolean` | no | default `true` |
| `isMember` | `boolean` | `boolean` | no | default `false` |
| `isProvisional` | `boolean` | `boolean` | no | default `false` |
| `availability` | `enum` | `AvailabilityStatus` | no | enum `AvailabilityStatus`, default `AvailabilityStatus.AVAILABLE` |
| `onboardingStatus` | `enum` | `OnboardingStatus` | no | enum `OnboardingStatus`, default `OnboardingStatus.NOT_APPLICABLE` |
| `notes` | `text` | `string` | sí | — |
| `notesEmoji` | `varchar` | `string` | sí | — |
| `shirtDate` | `date` | `Date` | sí | — |
| `joinDate` | `date` | `Date` | sí | — |
| `legacyId` | `varchar` | `string` | sí | — |
| `lastSyncedAt` | `timestamptz` | `Date` | sí | — |
| `positions` | `relation` | `Tag[]` | no | ManyToMany → `Tag` |
| `user` | `relation` | `Relation<User>` | sí | OneToOne → `User` |
| `mentor` | `relation` | `Person` | sí | ManyToOne → `Person` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `positions` — `Tag`

Definició: [`apps/api/src/modules/tag/tag.entity.ts`](../apps/api/src/modules/tag/tag.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `name` | `varchar` | `string` | no | unique |
| `slug` | `varchar` | `string` | no | unique |
| `shortDescription` | `varchar` | `string` | sí | — |
| `longDescription` | `text` | `string` | sí | — |
| `color` | `varchar` | `string` | sí | — |
| `positionTypes` | `text` | `string[]` | no | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `refresh_tokens` — `RefreshToken`

Definició: [`apps/api/src/modules/auth/entities/refresh-token.entity.ts`](../apps/api/src/modules/auth/entities/refresh-token.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `user` | `relation` | `User` | no | ManyToOne → `User`, onDelete CASCADE |
| `userId` | `uuid` | `string` | no | — |
| `tokenHash` | `varchar` | `string` | no | unique |
| `family` | `uuid` | `string` | no | — |
| `clientType` | `enum` | `ClientType` | no | enum `ClientType` |
| `expiresAt` | `timestamptz` | `Date` | no | — |
| `usedAt` | `timestamptz` | `Date` | sí | — |
| `revokedAt` | `timestamptz` | `Date` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |

### `rengles` — `Rengla`

Definició: [`apps/api/src/modules/figure/entities/rengla.entity.ts`](../apps/api/src/modules/figure/entities/rengla.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `template` | `relation` | `FigureTemplate` | no | ManyToOne → `FigureTemplate` |
| `name` | `varchar` | `string` | sí | — |
| `sortOrder` | `int` | `number` | no | default `0` |
| `createdAt` | `timestamptz` | `Date` | no | creació |

### `seasons` — `Season`

Definició: [`apps/api/src/modules/season/season.entity.ts`](../apps/api/src/modules/season/season.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `name` | `—` | `string` | no | unique |
| `startDate` | `date` | `Date` | no | — |
| `endDate` | `date` | `Date` | no | — |
| `description` | `text` | `string` | sí | — |
| `legacyId` | `varchar` | `string` | sí | unique |
| `events` | `relation` | `Event[]` | no | OneToMany → `Event` |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |

### `users` — `User`

Definició: [`apps/api/src/modules/user/user.entity.ts`](../apps/api/src/modules/user/user.entity.ts)

| Camp | Tipus DB | Tipus TS | Nullable | Notes |
|------|----------|----------|----------|-------|
| `id` | `—` | `string` | no | PK |
| `email` | `varchar` | `string` | no | unique |
| `passwordHash` | `varchar` | `string` | sí | — |
| `role` | `enum` | `UserRole` | no | enum `UserRole`, default `UserRole.MEMBER` |
| `isActive` | `boolean` | `boolean` | no | default `false` |
| `inviteToken` | `varchar` | `string` | sí | — |
| `inviteExpiresAt` | `timestamptz` | `Date` | sí | — |
| `resetToken` | `varchar` | `string` | sí | — |
| `resetExpiresAt` | `timestamptz` | `Date` | sí | — |
| `privacyPolicyAcceptedAt` | `timestamptz` | `Date` | sí | — |
| `privacyPolicyVersion` | `int` | `number` | sí | — |
| `createdAt` | `timestamptz` | `Date` | no | creació |
| `updatedAt` | `timestamptz` | `Date` | no | actualització |
| `person` | `relation` | `Relation<Person>` | sí | OneToOne → `undefined` |

<!-- END:AUTO -->

---

## Pendent de modelar

| Entitat | Quan | Descripció |
|---------|------|------------|
| `Notification` | amb el push de la PWA | Notificacions push/email |
| `Colla` | multi-tenant | Arrel del model; caldrà `collaId` al JWT i als guards (vegeu [[DEBT]] SEC4) |

`LegalDocument` i `AuditLog` (compliment LOPDGDD/RGPD) ja estan modelats — vegeu la secció
**Entitats** més amunt i [[GDPR_COMPLIANCE]]. Pendent (ajornat): `anonymizedAt` a `Person` per al
dret a l'oblit, vegeu [[DEBT]] SEC5.

Els camps sensibles (`email`, `phone`, `birthDate`) encara no s'encripten en repòs: [[DEBT]] SEC3.

---

*Veïns: [[PINYES_MODULE]] · [[SYNC_ARCHITECTURE]] · [[AUTH_FLOW]] · [[DEBT]] · [[MAP]]*
