# Sync Improvements — 2026-03-30

## Resum de Millores Implementades

### 1. ✅ Afegit camp `lastSyncedAt`

**Què fa:**
- Timestamp de la última sincronització per cada persona
- S'actualitza tant en CREATE com en UPDATE

**Beneficis:**
- Saber quan es va sincronitzar cada persona per última vegada
- Detectar persones que no s'han sincronitzat en molt temps
- Base per futures funcionalitats (conflict detection, stale data warnings)

**Canvis:**
- `person.entity.ts`: Afegit `@Column({ type: 'timestamp', nullable: true }) lastSyncedAt: Date | null`
- `person-sync.strategy.ts`: Assignat `lastSyncedAt = new Date()` en CREATE i UPDATE

### 2. ✅ Soft Delete Automàtic

**Què fa:**
- Al final de cada sync, marca com `isActive = false` les persones que ja NO estan al legacy API
- Només afecta persones amb `legacyId` (importades del legacy)

**Beneficis:**
- Detecta automàticament persones eliminades del legacy
- Mantén històric (no esborra dades)
- Reversible (si reapareix al legacy, es reactiva automàticament)
- No trenca relacions (events, attendance, etc.)

**Implementació:**
```typescript
private async deactivateMissingPersons(legacyPersons: LegacyPerson[]): Promise<number> {
  const legacyIds = legacyPersons.map((p) => p.id);

  const result = await this.personRepository
    .createQueryBuilder()
    .update(Person)
    .set({ isActive: false, lastSyncedAt: new Date() })
    .where('legacyId NOT IN (:...legacyIds)', { legacyIds })
    .andWhere('legacyId IS NOT NULL')
    .andWhere('isActive = :isActive', { isActive: true })
    .execute();

  return result.affected || 0;
}
```

**Canvis:**
- `person-sync.strategy.ts`: Afegit mètode `deactivateMissingPersons()`
- Cridat al final del sync, després de processar totes les persones
- Event SSE: Mostra "X persones desactivades" al resum final

### 3. ✅ Merge Strategy Refinada

**Què fa:**
- Defineix clarament quins camps es sincronitzen sempre i quins només en CREATE
- Documenta la filosofia: "Legacy API és la font de veritat per identitat i estat administratiu. MuixerApp és la font de veritat per configuració tècnica i notes locals."

**Camps sempre sincronitzats (CREATE + UPDATE):**
- Identitat: `name`, `firstSurname`, `secondSurname`, `alias`
- Contacte: `email`, `phone`
- Físic: `birthDate`, `shoulderHeight`
- Administratiu: `isMember`, `availability`, `onboardingStatus`, `shirtDate`
- Control: `isActive`, `lastSyncedAt`

**Camps només CREATE (mai UPDATE):**
- Configuració tècnica: `positions[]`, `isXicalla`
- Notes locals: `notes`

**Beneficis:**
- Les posicions assignades localment NO es sobreescriuen
- Les notes afegides localment NO es sobreescriuen
- Dades administratives sempre actualitzades des del legacy
- Previsible i documentat

**Canvis:**
- `person-sync.strategy.ts`: Comentaris explicatius a `updatePerson()`
- `docs/SYNC_MERGE_STRATEGY.md`: Documentació completa amb exemples

### 4. ✅ Millora de `isActive`

**Abans:**
- Hardcoded a `true` sempre (línia 244)
- No detectava eliminacions

**Després:**
- `true` si la persona està al legacy API
- `false` si desapareix del legacy (soft delete automàtic)
- Actualitzat en cada sync

**Beneficis:**
- Estat consistent amb la realitat del legacy
- Filtratge de persones inactives al dashboard
- Històric preservat

## Problemes Resolts

### ❌ Problema 1: N+1 Queries

**Estat:** ⚠️ PENDENT (no implementat en aquesta millora)

**Situació actual:**
- 1 SELECT + 1 INSERT/UPDATE per cada persona
- Si tens 300 persones = 600 queries

**Solució proposada:**
- Usar TypeORM `upsert()` per processar totes les persones d'un cop
- Bulk operations per positions

**Motiu de no implementar ara:**
- Canvi arquitectural més gran
- Requereix refactoring del flux de SSE (progress per persona)
- Millora de performance, no de funcionalitat

### ✅ Problema 2: No detecta eliminacions

**RESOLT** amb soft delete automàtic.

### ✅ Problema 3: Sobreescriu canvis locals

**RESOLT** amb merge strategy refinada (positions i notes NO es toquen en UPDATE).

### ✅ Problema 4: No hi ha timestamps

**RESOLT** amb `lastSyncedAt`.

## Documentació Afegida

1. **`docs/SYNC_MERGE_STRATEGY.md`**
   - Filosofia de sincronització
   - Regles per camp (CREATE vs UPDATE)
   - Soft delete automàtic
   - Exemples pràctics
   - Troubleshooting

2. **`docs/SYNC_IMPROVEMENTS_2026-03-30.md`** (aquest fitxer)
   - Resum de millores
   - Problemes resolts
   - Pendent de fer

3. **Actualitzat `docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`**
   - Afegits camps `isActive` i `lastSyncedAt` a la taula de merge rules
   - Actualitzat pseudocodi amb soft delete

## ✅ Gestió Manual d'Activació (Implementat)

A més del soft delete automàtic, s'han afegit endpoints per gestió manual:

### Endpoints

**Desactivar persona:**
```http
PATCH /api/persons/:id/deactivate
```

**Activar persona:**
```http
PATCH /api/persons/:id/activate
```

### Funcionalitat

- Actualitza `isActive` (`true` o `false`)
- Actualitza `lastSyncedAt` per registrar la modificació manual
- Retorna la persona actualitzada (DTO complet)
- Llança `NotFoundException` si la persona no existeix

### Casos d'ús

**Desactivar:**
- Persona que deixa la colla temporalment
- Baixa mèdica prolongada
- Correcció manual després d'un sync erroni

**Activar:**
- Reactivar persona desactivada manualment
- Corregir persona desactivada erròniament pel sync
- Persona que torna després d'una baixa

### Tests

Afegits tests unitaris a `person.service.spec.ts`:
- `deactivate()` — verifica que marca com inactiva i actualitza `lastSyncedAt`
- `activate()` — verifica que marca com activa i actualitza `lastSyncedAt`
- Ambdós llancen `NotFoundException` si la persona no existeix

---

## Pendent de Fer (Futures Millores)

### 1. Bulk Upsert (Performance)

**Objectiu:** Reduir de 600 queries a ~10 queries per sync.

**Implementació:**
```typescript
// En lloc de 1 a 1:
for (const person of persons) {
  await upsertPerson(person);
}

// Fer bulk:
await personRepository.upsert(
  persons.map(mapToEntity),
  { conflictPaths: ['legacyId'], skipUpdateIfNoValuesChanged: true }
);
```

**Complexitat:** Alta (requereix refactoring del flux SSE).

### 2. Conflict Detection

**Objectiu:** Detectar camps modificats localment després de l'última sync.

**Implementació:**
```typescript
if (existing.email !== legacyEmail && existing.updatedAt > existing.lastSyncedAt) {
  // Email modificat localment després de l'última sync
  // Opció 1: Mostrar warning
  // Opció 2: Demanar confirmació
  // Opció 3: Mantenir el valor local
}
```

**Complexitat:** Mitjana (requereix definir política de resolució de conflictes).

### 3. Sync Selectiu de Posicions

**Objectiu:** Permetre forçar actualització de posicions quan sigui necessari.

**Implementació:**
```typescript
@Get('persons')
@Sse()
syncPersons(@Query('syncPositions') syncPositions?: boolean): Observable<MessageEvent> {
  return this.personSyncStrategy.execute({ syncPositions }).pipe(...);
}
```

**Complexitat:** Baixa (afegir flag i condicional).

### 4. Dry Run Mode

**Objectiu:** Previsualitzar canvis sense aplicar-los.

**Implementació:**
```typescript
@Get('persons/preview')
async previewSync(): Promise<SyncPreview> {
  return this.personSyncStrategy.preview();
}
```

**Complexitat:** Mitjana (duplicar lògica sense save).

### 5. Sync Incremental

**Objectiu:** Només sincronitzar persones modificades des de l'última sync.

**Requeriments:**
- El legacy API ha de proporcionar `updated_at` o similar
- Guardar timestamp de l'última sync completa

**Complexitat:** Alta (depèn del legacy API).

## Testing

### Tests Afegits

Pendent: Afegir tests per:
- `deactivateMissingPersons()` — verifica que marca com inactives les persones correctes
- `lastSyncedAt` — verifica que s'actualitza en CREATE i UPDATE
- Merge strategy — verifica que positions i notes NO es toquen en UPDATE

### Tests Manuals

Executar sync i verificar:
1. ✅ `lastSyncedAt` s'actualitza per totes les persones
2. ✅ Persones noves tenen `isActive = true`
3. ✅ Persones existents mantenen `isActive = true`
4. ✅ Persones que desapareixen del legacy es marquen com `isActive = false`
5. ✅ Posicions assignades localment NO es sobreescriuen
6. ✅ Notes afegides localment NO es sobreescriuen
7. ✅ Dades administratives (email, phone, etc.) SÍ s'actualitzen

## Migració

### Base de Dades

**TypeORM Sync:** El camp `lastSyncedAt` es crearà automàticament en dev (`synchronize: true`).

**Producció:** Crear migració manual:

```sql
ALTER TABLE persons
ADD COLUMN last_synced_at TIMESTAMP NULL;

-- Opcional: Marcar totes les persones existents amb timestamp actual
UPDATE persons
SET last_synced_at = NOW()
WHERE legacy_id IS NOT NULL;
```

### Codi

No cal migració de codi. Els canvis són compatibles amb dades existents:
- `lastSyncedAt` és nullable (persones existents tindran `null` fins al proper sync)
- `isActive` ja existia (default `true`)
- Merge strategy només afecta UPDATE (no trenca CREATE)

## Referències

- **Merge Strategy:** `docs/SYNC_MERGE_STRATEGY.md`
- **Spec Original:** `docs/specs/2026-03-30-vertical-slice-completion-sync-dashboard-design.md`
- **Entity:** `apps/api/src/modules/person/person.entity.ts`
- **Strategy:** `apps/api/src/modules/sync/strategies/person-sync.strategy.ts`
