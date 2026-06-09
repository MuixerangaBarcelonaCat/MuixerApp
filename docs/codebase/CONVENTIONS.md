# Convencions de Codi — MuixerApp

> Generat automàticament per la skill `acquire-codebase-knowledge` el 23/04/2026.  
> Evidència: fitxers de configuració i inspecció directa del codi font.

---

## 1. Regles de Nomenclatura

| Element | Regla | Exemple | Evidència |
|---------|-------|---------|-----------|
| **Fitxers** | `kebab-case` + sufix del tipus | `person-list.component.ts`, `auth.service.ts`, `jwt-auth.guard.ts` | Tots els fitxers de `apps/` |
| **Directoris** | `kebab-case` | `features/events/`, `shared/components/data/` | `apps/dashboard/src/app/` |
| **Classes** | `PascalCase` + sufix del rol | `PersonService`, `JwtAuthGuard`, `PersonListComponent` | Tots els fitxers `.ts` |
| **Interfaces** | `PascalCase` sense prefix ni sufix | `UserProfile`, `JwtPayload`, `AttendanceSummary` | `libs/shared/src/interfaces/` |
| **Enums** | `PascalCase` | `UserRole`, `AttendanceStatus` | `libs/shared/src/enums/` |
| **Valors d'enum** | `UPPER_SNAKE_CASE` | `ANIRE`, `NO_VAIG`, `LONG_TERM_UNAVAILABLE` | `attendance-status.enum.ts` |
| **Mètodes i funcions** | `camelCase` | `getPersonById`, `rotateRefreshToken` | `person.service.ts` |
| **Variables i propietats** | `camelCase` | `currentUser`, `isAuthenticated` | `auth.service.ts` |
| **Signals Angular** | `camelCase` (sense sufix especial) | `currentUser`, `isReady`, `userRole` | `core/auth/services/auth.service.ts` |
| **Constants** | `UPPER_SNAKE_CASE` | `SEASON_CUTOFF`, `REFRESH_TOKEN_COOKIE` | `auth.constants.ts` |
| **Variables d'entorn** | `UPPER_SNAKE_CASE` | `JWT_SECRET`, `DATABASE_URL` | `.env.example` |

---

## 2. Idioma

| Context | Idioma | Exemples |
|---------|--------|----------|
| **Codi** (variables, funcions, classes, endpoints, commits) | **Anglès** | `getPersonById`, `POST /api/events`, `feat(api): add attendance CRUD` |
| **UI** (texts, botons, labels, missatges d'error) | **Català** | `"Desa els canvis"`, `"Persona no trobada"`, `"Ves a la llista"` |
| **Comentaris JSDoc i documentació** | **Català** | `/** Valida el token i retorna el payload JWT */` |
| **Descripcions Swagger** (`@ApiOperation`, `@ApiProperty`) | **Català** | `description: 'Llista totes les persones actives'` |

---

## 3. Formatació i Linting

- **Formatter**: Prettier 3.6.x — configuració: `singleQuote: true` (`.prettierrc`)
- **Linter**: ESLint 9.x amb typescript-eslint i angular-eslint
  - Backend: `apps/api/` — TypeScript strict
  - Frontend: `apps/dashboard/eslint.config.mjs` — TypeScript + Angular
- **TypeScript**: mode estricte — **cap `any`** permès

```bash
# Formatació
npx prettier --write .

# Linting
nx lint api
nx lint dashboard
```

**Regles ESLint rellevants (verificades al codi):**
- `@typescript-eslint/no-explicit-any` — enforced
- `@typescript-eslint/no-require-imports` — enforced (excepció a `main.ts` per `cookie-parser`)
- `no-unused-vars` — enforced

---

## 4. Imports i Mòduls

**Imports al backend (NestJS):**
- S'usen imports relatius dins d'un mòdul (`./person.service`, `../entities/person.entity`)
- Imports de `@muixer/shared` per a enums i interfaces compartides
- Cap barrel personalitzat dins dels mòduls

**Imports al frontend (Angular):**
- S'usa l'alias `@app/*` per a imports dins de `apps/dashboard/src/app/`
- S'usa `@muixer/shared` per a enums i interfaces
- Tots els components són **standalone** — s'importa directament el component necessari, no NgModules
- Hi ha un barrel a `shared/utils/index.ts` que re-exporta les utilitats comunes

**Exemple d'import correcte (frontend):**
```typescript
import { PersonService } from '@app/features/persons/services/person.service';
import { UserRole } from '@muixer/shared';
import { DataTableComponent } from '../../shared/components/data/data-table/data-table.component';
```

---

## 5. Gestió d'Errors

| Capa | Estratègia | Exemple |
|------|------------|---------|
| **Backend — Controller** | Llançar excepcions NestJS (`NotFoundException`, `ConflictException`) | `throw new NotFoundException('Persona no trobada')` |
| **Backend — Service** | Llançar excepcions HTTP de NestJS. Missatges en català per consistència amb la UI | `throw new ConflictException('L\'event té assistències i no es pot eliminar')` |
| **Backend — Guard** | Llançar `UnauthorizedException` o `ForbiddenException` | `throw new UnauthorizedException()` |
| **Frontend — Service** | Propagar errors via Observables/Promises; components decideixen com mostrar-los | `return this.api.get<Person[]>('/persons')` (errors passen al component) |
| **Frontend — Component** | Capturar errors i mostrar feedback a l'usuari (toast o missatge inline) | `catch { this.error.set('Error en carregar les dades') }` |

**Nota**: La `ValidationPipe` global del backend (`whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`) rebutja automàticament qualsevol camp no declarat al DTO.

---

## 6. Components Angular

**Regla**: tots els components usen **2 fitxers** com a mínim: `.ts` + `.html`. El `.scss` s'evita — els estils es fan amb **Tailwind CSS v3 + DaisyUI v4**.

```typescript
@Component({
  selector: 'app-example',
  standalone: true,               // Sempre standalone
  changeDetection: ChangeDetectionStrategy.OnPush,  // Sempre OnPush
  imports: [CommonModule, ...],   // Imports explícits
  templateUrl: './example.component.html',
})
export class ExampleComponent {
  // Estat reactiu via signals
  readonly items = signal<Item[]>([]);
  readonly isLoading = signal(false);
  
  // Injecció de dependències via inject()
  private readonly service = inject(ExampleService);
}
```

---

## 7. Serveis Angular

- S'injecten via `inject()` (no constructors), excepte quan un lifecycle hook requereix el constructor
- L'estat local es gestiona amb `signal()` i `computed()`
- **No s'usa `BehaviorSubject`** per a estat local — es reserva RxJS per a HTTP (Observables) i casos concrets d'async
- Els serveis d'API retornen Observables o Promises — no guarden estat local

---

## 8. Entitats TypeORM

```typescript
@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  secondSurname: string | null;
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Regles TypeORM observades:**
- Soft delete via `isActive: boolean` — **no** s'usa `@DeleteDateColumn`
- Claus primàries sempre `uuid` auto-generat
- Camps `createdAt` / `updatedAt` via `@CreateDateColumn` / `@UpdateDateColumn`
- Relacions sempre declarades explícitament amb `@ManyToOne`, `@OneToMany`, `@OneToOne`, `@ManyToMany`

---

## 9. Convencions de Tests

- **Fitxers de test**: co-ubicats amb el fitxer font, sufix `.spec.ts`
  - Exemple: `person.service.ts` → `person.service.spec.ts`
- **Patró**: AAA (Arrange, Act, Assert)
- **Backend**: Jest 30.x + `@nestjs/testing` (`Test.createTestingModule`)
- **Frontend**: Vitest 4.x (configuració a `tsconfig.spec.json`)
- **Mocking backend**: `jest.fn()` per a repositoris, `createMock()` o `jest.spyOn` per a serveis
- **No hi ha coverage threshold** configurat explícitament (camp `coverageThreshold` absent de `jest.config.ts`)

---

## 10. Evidència

- `.prettierrc` — `singleQuote: true`
- `apps/dashboard/eslint.config.mjs` — regles ESLint del frontend
- `apps/api/jest.config.ts` — configuració de tests backend
- `apps/api/src/modules/person/person.service.ts` — estil de servei NestJS
- `apps/dashboard/src/app/core/auth/services/auth.service.ts` — estil de servei Angular amb signals
- `.cursor/rules/muixer-language.mdc` — regla oficial d'idioma (EN codi, CA UI)
- `.cursor/rules/angular-component-structure.mdc` — estructura de components Angular
- `.cursor/rules/typeorm-patterns.mdc` — patrons TypeORM
