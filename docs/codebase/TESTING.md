# Patrons de Testing — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Evidència: configuració de tests verificada als fitxers del repositori.

---

## 1. Stack de Testing i Comandes

| Aplicació | Framework | Ús |
|-----------|-----------|-----|
| **Backend** (`apps/api`) | Jest 30.x + `@nestjs/testing` | Tests unitaris i d'integració de serveis/controllers |
| **Frontend** (`apps/dashboard`) | Vitest 4.x | Tests unitaris de serveis i guards |
| **E2E** (`apps/dashboard-e2e`) | Playwright 1.36+ | Tests de flux complet al navegador |

```bash
# Tests del backend (Jest)
nx test api

# Tests del frontend (Vitest)
nx test dashboard

# Tests E2E (Playwright)
nx e2e dashboard-e2e

# Tots els tests del monorepo
nx run-many -t test

# Amb coverage (backend)
nx test api --coverage

# Amb coverage (frontend)
nx test dashboard --coverage
```

---

## 2. Ubicació dels Fitxers de Test

**Regla**: els fitxers de test es col·loquen **co-ubicats** amb el fitxer font, amb el sufix `.spec.ts`.

```
apps/api/src/modules/person/
  ├── person.service.ts
  ├── person.service.spec.ts       ← Jest
  ├── person.controller.ts
  ├── person.controller.spec.ts    ← Jest
  └── dto/
      └── person-filter.dto.spec.ts

apps/dashboard/src/app/core/auth/
  ├── services/auth.service.ts
  ├── services/auth.service.spec.ts    ← Vitest
  ├── guards/auth.guard.ts
  ├── guards/auth.guard.spec.ts        ← Vitest
  └── guards/role.guard.spec.ts        ← Vitest

apps/dashboard-e2e/src/
  └── example.spec.ts                  ← Playwright
```

---

## 3. Matriu de Cobertura

| Abast | Cobert? | Objectiu típic | Notes |
|-------|---------|----------------|-------|
| **Unitari backend** | ✅ Sí | Serveis NestJS, Guards, DTOs | `person.service.spec.ts`, `auth.service.spec.ts`, `token.service.spec.ts` |
| **Unitari frontend** | ✅ Sí | AuthService, Guards, Utils | `auth.service.spec.ts`, `auth.guard.spec.ts`, `role.guard.spec.ts`, `http-params.util.spec.ts` |
| **Integració backend** | ✅ Parcial | Controllers amb mòdul NestJS de testing | `person.controller.spec.ts` usa `Test.createTestingModule` |
| **E2E** | ⚠️ Mínim | Smoke test del dashboard | `apps/dashboard-e2e/src/example.spec.ts` — test de prova Nx scaffold |
| **Estratègies de sync** | ❌ No | `PersonSyncStrategy`, `EventSyncStrategy`, `AttendanceSyncStrategy` | Tests pendents — complexitat de mocking del legacy API |

---

## 4. Estratègia de Mocking i Aïllament

### Backend (Jest + `@nestjs/testing`)

```typescript
// Patró estàndard de mocking de repositori TypeORM
const module = await Test.createTestingModule({
  providers: [
    PersonService,
    {
      provide: getRepositoryToken(Person),
      useValue: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
      },
    },
  ],
}).compile();
```

- Els repositoris TypeORM es mockegen amb `jest.fn()` via `getRepositoryToken(Entity)`
- Els serveis externs (p.ex. `LegacyApiClient`) es mockegen com a objectes literals
- **Cada test suite usa el seu propi mòdul** — no hi ha estat compartit entre suites

### Frontend (Vitest)

```typescript
// Patró estàndard de mocking de HttpClient
const service = new AuthService(mockHttpClient);
mockHttpClient.post.mockResolvedValue({ accessToken: 'tok', user: mockUser });
```

- `HttpClient` es mocka via objectes amb `vi.fn()` o `jest.fn()`
- Els guards s'injecten amb `inject()` i es testa el comportament via `CanActivateFn`

---

## 5. Cobertura i Qualitat

| Aspecte | Estat |
|---------|-------|
| **Coverage threshold** | No configurat explícitament a `jest.config.ts` ni `tsconfig.spec.json` |
| **Coverage actual** | [TODO] Executar `nx test api --coverage` per obtenir l'informe actualitzat |
| **Fitxers exclosos del coverage** | DTOs, entitats, interfaces, `main.ts` (configurat a `jest.config.ts`) |
| **Tests flaky coneguts** | Cap identificat |
| **Cobertura de les estratègies de sync** | **Zero** — àrea de risc identificada |

---

## 6. Patró AAA (Arrange, Act, Assert)

Tots els tests segueixen el patró AAA. Exemple representatiu:

```typescript
it('should return active persons only', async () => {
  // Arrange
  const mockPersons = [{ id: '1', isActive: true, name: 'Anna' }];
  mockRepository.find.mockResolvedValue(mockPersons);

  // Act
  const result = await service.findAll({ isActive: true });

  // Assert
  expect(result).toHaveLength(1);
  expect(mockRepository.find).toHaveBeenCalledWith(
    expect.objectContaining({ where: { isActive: true } }),
  );
});
```

---

## 7. Tests Existents per Mòdul (Inventari)

| Fitxer de test | Cobreix |
|----------------|---------|
| `person.service.spec.ts` | PersonService: CRUD, filtres, persones provisionals |
| `person.controller.spec.ts` | PersonController: endpoints HTTP bàsics |
| `person-filter.dto.spec.ts` | Validació del PersonFilterDto |
| `auth.service.spec.ts` | AuthService: login, refresh, logout, setupUser |
| `token.service.spec.ts` | TokenService: creació, rotació, revocació de refresh tokens |
| `auth.service.spec.ts` (dashboard) | AuthService Angular: init, refresh, logout |
| `auth.guard.spec.ts` | authGuard: redireccions, espera `whenReady()` |
| `role.guard.spec.ts` | rolesGuard: verificació de rol, accés denegat |
| `http-params.util.spec.ts` | buildHttpParams: conversió d'objectes a HttpParams |
| `app.spec.ts` | Smoke test de l'AppComponent |

---

## 8. Àrees Sense Tests (Deute de Cobertura)

| Àrea | Risc | Prioritat suggericada |
|------|------|-----------------------|
| `PersonSyncStrategy` | Alta complexitat, lògica de merge crítica | Alta |
| `EventSyncStrategy` | Parsing HTML, gestió de temporades hardcoded | Alta |
| `AttendanceSyncStrategy` | Parsing XLSX, mapeig d'estats | Alta |
| `LegacyApiClient` | Integració amb sistema extern | Mitjana |
| `PersonDetailComponent` (dashboard) | Formulari d'edició, canvis d'estat | Mitjana |
| `EventDetailComponent` (dashboard) | CRUD assistència, modals | Mitjana |
| E2E flows complets | Login, sincronització, gestió d'assistència | Baixa (pendent infraestructura) |

---

## 9. Evidència

- `apps/api/jest.config.ts` — configuració de Jest per al backend
- `apps/dashboard/tsconfig.spec.json` — configuració de Vitest per al frontend
- `apps/dashboard-e2e/playwright.config.ts` — configuració de Playwright
- `apps/api/src/modules/person/person.service.spec.ts` — test unitari representatiu
- `apps/api/src/modules/auth/token.service.spec.ts` — test amb mocking de repositori
- `apps/dashboard/src/app/core/auth/services/auth.service.spec.ts` — test de servei Angular
