# Model de Dades — MuixerApp

> Última actualització: 31 de març de 2026  
> Estat: P0–P2 implementat. P3+ pendent.

---

## Entitats Actuals

### `persons`

Membre de la colla (qualsevol persona registrada al sistema, independentment del rol muixeranguer).

| Camp | Tipus DB | TypeScript | Nullable | Notes |
|------|----------|------------|----------|-------|
| `id` | `uuid` | `string` | No | PK, auto-generat |
| `name` | `varchar` | `string` | No | Nom de pila |
| `firstSurname` | `varchar` | `string` | No | Primer cognom |
| `secondSurname` | `varchar` | `string \| null` | Sí | |
| `alias` | `varchar(20)` | `string` | No | Únic a la taula |
| `email` | `varchar` | `string \| null` | Sí | |
| `phone` | `varchar` | `string \| null` | Sí | |
| `birthDate` | `date` | `Date \| null` | Sí | |
| `shoulderHeight` | `int` | `number \| null` | Sí | Alçada espatlla en cm |
| `gender` | `enum` | `Gender \| null` | Sí | `MALE \| FEMALE \| OTHER` |
| `isXicalla` | `boolean` | `boolean` | No | Default `false`. Xicalla = < 16 anys |
| `isActive` | `boolean` | `boolean` | No | Default `true`. Soft delete |
| `isMember` | `boolean` | `boolean` | No | Default `false`. Soci de la colla |
| `availability` | `enum` | `AvailabilityStatus` | No | Default `AVAILABLE` |
| `onboardingStatus` | `enum` | `OnboardingStatus` | No | Default `NOT_APPLICABLE` |
| `notes` | `text` | `string \| null` | Sí | Notes internes (no sincronitza) |
| `shirtDate` | `date` | `Date \| null` | Sí | Data d'entrega de samarreta |
| `joinDate` | `date` | `Date \| null` | Sí | Data d'incorporació |
| `isMainAccount` | `boolean` | `boolean` | No | Default `true` |
| `legacyId` | `varchar` | `string \| null` | Sí | ID a l'API legacy (migració) |
| `lastSyncedAt` | `timestamp` | `Date \| null` | Sí | Última sincronització |
| `managedBy` | FK → `users` | `User \| null` | Sí | ManyToOne |
| `mentor` | FK → `persons` | `Person \| null` | Sí | Self-referencing ManyToOne |
| `positions` | JT `person_positions` | `Position[]` | — | ManyToMany |
| `createdAt` | `timestamp` | `Date` | No | Auto |
| `updatedAt` | `timestamp` | `Date` | No | Auto |

---

### `positions`

Posicions muixerangueres (pinya, tronc, caps de colla...). Gestionades internament, no sincronitzen amb legacy.

| Camp | Tipus DB | TypeScript | Nullable | Notes |
|------|----------|------------|----------|-------|
| `id` | `uuid` | `string` | No | PK |
| `name` | `varchar` | `string` | No | Únic. Ex: `"Baix"` |
| `slug` | `varchar` | `string` | No | Únic. Ex: `"baix"` |
| `shortDescription` | `varchar` | `string \| null` | Sí | |
| `longDescription` | `text` | `string \| null` | Sí | |
| `color` | `varchar` | `string \| null` | Sí | Hex, ex: `"#FF5733"` |
| `zone` | `enum` | `FigureZone \| null` | Sí | `PINYA \| TRONC \| FIGURE_DIRECTION \| XICALLA_DIRECTION` |
| `createdAt` | `timestamp` | `Date` | No | Auto |
| `updatedAt` | `timestamp` | `Date` | No | Auto |

---

### `users`

Compte d'accés a l'aplicació. Desacoblat de `Person` (una persona pot no tenir compte, un compte pot gestionar múltiples persones).

| Camp | Tipus DB | TypeScript | Nullable | Notes |
|------|----------|------------|----------|-------|
| `id` | `uuid` | `string` | No | PK |
| `passwordHash` | `varchar` | `string` | No | bcrypt cost 12+ |
| `role` | `enum` | `UserRole` | No | Default `MEMBER`. `ADMIN \| TECHNICAL \| MEMBER` |
| `isActive` | `boolean` | `boolean` | No | Default `false` |
| `inviteToken` | `varchar` | `string \| null` | Sí | Token d'invitació per email |
| `inviteExpiresAt` | `timestamp` | `Date \| null` | Sí | |
| `resetToken` | `varchar` | `string \| null` | Sí | Token de reset de password |
| `resetExpiresAt` | `timestamp` | `Date \| null` | Sí | |
| `createdAt` | `timestamp` | `Date` | No | Auto |
| `updatedAt` | `timestamp` | `Date` | No | Auto |

---

### `person_positions` (Join Table)

Taula de creuament M:N entre `persons` i `positions`. Gestionada per TypeORM via `@JoinTable`.

| Camp | Notes |
|------|-------|
| `persons_id` | FK → `persons.id` |
| `positions_id` | FK → `positions.id` |

---

## Enums (`libs/shared`)

### `Gender`
```typescript
MALE | FEMALE | OTHER
```

### `AvailabilityStatus`
```typescript
AVAILABLE | TEMPORARILY_UNAVAILABLE | LONG_TERM_UNAVAILABLE
```

### `OnboardingStatus`
```typescript
COMPLETED | IN_PROGRESS | LOST | NOT_APPLICABLE
```

### `UserRole`
```typescript
ADMIN | TECHNICAL | MEMBER
```

### `FigureZone`
```typescript
PINYA | TRONC | FIGURE_DIRECTION | XICALLA_DIRECTION
```

---

## Relacions

```
User ──< Person (managedBy) : un User pot gestionar N persones
Person ──< Person (mentor)  : auto-referència (mentor/aprenent)
Person >──< Position        : via person_positions (M:N)
```

---

## Entitats Pendents (P3+)

Entitats a dissenyar i implementar en fases futures:

| Entitat | Fase | Descripció |
|---------|------|------------|
| `Season` | P3 | Temporada (ex: 2025-2026) |
| `Event` | P3 | Assaig, actuació, assemblea... |
| `Attendance` | P3 | Assistència d'una `Person` a un `Event` |
| `FigureTemplate` | P6 | Plantilla de figura muixeranguera |
| `FigureInstance` | P6 | Instància concreta d'una figura en un `Event` |
| `FigurePosition` | P6 | Assignació `Person` → posició en una figura |
| `Notification` | P7 | Notificacions push/email |

---

## Notes de Disseny

- **Soft delete**: `isActive: boolean` a `Person`. No s'usa `@DeleteDateColumn` de TypeORM.
- **Sync**: `legacyId` + `lastSyncedAt` a `Person` per traçabilitat amb l'API legacy. Vegeu `SYNC_MERGE_STRATEGY.md`.
- **Auth**: `User` té `inviteToken` i `resetToken` per al flux d'autenticació (pendent d'implementar, P3).
- **Multi-tenant**: Arquitectura preparada per afegir `Colla` com a arrel de tot el model (P futur).
- **GDPR**: Camps sensibles (`email`, `phone`, `birthDate`) requeriran encriptació en repòs (pendent).
