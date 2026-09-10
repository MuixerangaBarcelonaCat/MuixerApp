# GDPR — Visibilitat de dades personals per rol

> **Data:** 10 de setembre de 2026
> **Estat:** Disseny aprovat
> **Prerequisits:** P4.1 (auth layer amb JWT + rols)

---

## 1. Objectiu

Restringir l'accés a les dades personals de les persones del cens: només els usuaris amb rol `ADMIN` les poden veure. Els usuaris `TECHNICAL` treballen amb la informació operativa de la colla (àlies, nom, posicions, disponibilitat, alçada) sense accés a cognoms, telèfon, data de naixement ni observacions.

**Principi rector:** minimització de dades (GDPR art. 5.1.c). Si una pantalla no necessita un camp personal per funcionar, el camp no s'envia — ni tan sols amagat al frontend.

**Capacitats:**

1. **Serialització per rol** — l'API no envia mai camps personals a un `TECHNICAL`.
2. **Tancament de canals d'inferència** — ordenació i cerca no permeten deduir camps amagats.
3. **Minimització transversal** — els mòduls d'assistència, assignacions i projecció deixen d'enviar cognoms a tothom.
4. **UI coherent** — llistat i detall amaguen els camps protegits i no permeten editar-los.

---

## 2. Classificació de camps

| Camp | Visibilitat | Notes |
|------|-------------|-------|
| `alias` | Tots | Identificador operatiu, únic a BD |
| `name` | Tots | Nom de fonts, necessari per desambiguar |
| `firstSurname` | **Només ADMIN** | |
| `secondSurname` | **Només ADMIN** | |
| `phone` | **Només ADMIN** | |
| `birthDate` | **Només ADMIN** | |
| `notes` | **Només ADMIN** | Observacions sobre la persona |
| `managedBy.email` | **Només ADMIN** | Correu de l'usuari vinculat |
| `shoulderHeight` | Tots | Dada operativa imprescindible per a pinyes |
| `positions`, `availability`, `onboardingStatus` | Tots | |
| `isActive`, `isMember`, `isXicalla`, `isProvisional`, `shirtDate` | Tots | |
| `createdAt`, `updatedAt` | Tots | |
| `gender` | Ningú | Ja no s'exposa avui; es manté així |

---

## 3. Decisions de disseny

| Decisió | Resultat |
|---------|----------|
| Mecanisme de serialització | **`@Expose({ groups })` de class-transformer** — els camps protegits es marquen amb el grup `personal`; els no marcats sempre s'exposen. Font de veritat única. |
| Alternativa descartada (DTO doble) | Un `PersonPublicResponseDto` duplicaria ~20 declaracions de camp i derivaria a la primera columna nova. |
| Alternativa descartada (interceptor global) | Esborrar claus per nom a totes les respostes és insegur: `name` i `notes` col·lisionen amb `Event.name`, `Attendance.notes` i `FigureTemplate.name`. |
| Absència vs `null` | Els camps protegits **s'ometen** de la resposta (no s'envien com a `null`), perquè el frontend no pugui confondre "amagat" amb "buit". |
| Camps personals en altres mòduls | **Minimització per a tothom** en lloc de propagar el rol per quatre serveis més. |
| Ordenació per camp protegit | **Fallback silenciós a `alias`** per a `TECHNICAL`, no error 400: una vista desada per un admin degrada en lloc de petar. |
| Camps editables per `TECHNICAL` | `alias`, `name` i `shoulderHeight` **es mantenen editables** — són dades operatives que la comissió tècnica necessita. Els camps `ADMIN`-only no es renderitzen. |
| Promoció de provisional a membre | **Només `ADMIN`** — `PersonService.update` exigeix `firstSurname` no buit i un usuari vinculat, així que el flux requereix dades personals per definició. |
| Construcció del payload de desat | **Llista blanca explícita de claus**, no "controls `disabled` + `getRawValue()`" — `getRawValue()` inclou els controls deshabilitats. |
| Permisos d'escriptura de persones | **Sense canvis** (decisió del producte). Vegeu §6.2. |
| Gestió d'usuaris (`/config/users`) | **Passa a només `ADMIN`**. |

---

## 4. Backend

### 4.1 `PersonResponseDto` — grups de serialització

**`apps/api/src/modules/person/dto/person-response.dto.ts`**

```typescript
/** Grup de class-transformer per als camps de dades personals (només ADMIN). */
export const PERSONAL_DATA_GROUP = 'personal';

export class PersonResponseDto {
  @Expose()
  id: string;

  @Expose()
  name: string;

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  firstSurname: string;

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  secondSurname: string | null;

  @Expose()
  alias: string;

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  phone: string | null;

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  birthDate: Date | null;

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  notes: string | null;

  // … resta de camps sense grup (sempre visibles)

  @Expose({ groups: [PERSONAL_DATA_GROUP] })
  @Type(() => ManagedByUserDto)
  managedBy: ManagedByUserDto | null;
}
```

`ManagedByPersonDto` (dins de `managedBy`) també perd `name`, `firstSurname` i `secondSurname` per coherència: el bloc sencer és `ADMIN`-only, i qui el rep només necessita `id` + `alias` per enllaçar.

**Neteja:** s'elimina `@Expose() email` del DTO. `Person` no té columna `email`; el camp sempre arriba `undefined`.

### 4.2 `PersonService` — helper de serialització

**`apps/api/src/modules/person/person.service.ts`**

```typescript
private toResponseDto(person: Person, role: UserRole): PersonResponseDto {
  return plainToInstance(PersonResponseDto, person, {
    excludeExtraneousValues: true,
    groups: role === UserRole.ADMIN ? [PERSONAL_DATA_GROUP] : [],
  });
}
```

Els set mètodes que retornen persones (`findAll`, `findOne`, `create`, `createProvisional`, `update`, `activate`, `deactivate`) reben `role: UserRole` i deleguen aquí. `softDelete` no retorna res i no canvia.

### 4.3 `PersonController` — propagació del rol

Cada handler afegeix `@CurrentUser() user: JwtPayload` i passa `user.role` al servei. El decorador ja existeix a `apps/api/src/modules/auth/decorators/current-user.decorator.ts`.

### 4.4 Ordenació — tancar la inferència per ordre

Ordenar per `birthDate` classifica la colla per edat; ordenar per `phone` agrupa números. **`apps/api/src/modules/person/constants/person-sort.constants.ts`**:

```typescript
/** Camps d'ordenació que revelen dades personals a través de l'ordre dels resultats. */
export const PERSONAL_SORT_FIELDS: readonly PersonSortByField[] = [
  'firstSurname',
  'phone',
  'birthDate',
] as const;
```

`resolveSortColumn(sortBy, role)` retorna `person.alias` si `sortBy` és un camp personal i el rol no és `ADMIN`.

**Neteja:** s'eliminen `'email'` de `PERSON_SORT_BY_FIELDS` i l'entrada `email: 'person.email'` de `PERSON_SORT_COLUMN_MAP`. Aquesta entrada apunta a una columna inexistent, així que `?sortBy=email` provoca un error SQL avui.

### 4.5 Cerca — tancar la inferència per coincidència

Provar "Garcia" en un cercador i llegir qui apareix als resultats permet deduir cognoms sense que el camp surti mai a la resposta. Hi ha **quatre** clàusules `ILIKE` sobre `firstSurname` al backend:

| Fitxer | Endpoint | Acció |
|--------|----------|-------|
| `modules/person/person.service.ts:62` | `GET /persons` | Per a `TECHNICAL` la clàusula es redueix a `alias` + `name`; per a `ADMIN` es manté completa (inclou `secondSurname`) |
| `modules/event/attendance.service.ts:47` | `GET /events/:id/attendance` | S'elimina `firstSurname` de la clàusula **per a tots els rols** (coherent amb §4.6) |
| `modules/node-assignment/available-persons.service.ts:95` | `GET /events/:eventId/segments/:segmentId/available-persons` | Igual: s'elimina `firstSurname` per a tots els rols |
| `modules/user/user.service.ts:95` | `GET /users` | **Sense canvis** — l'endpoint passa a `ADMIN`-only a §4.7, així que no hi ha fuita |

### 4.6 Minimització en altres mòduls

Aquests quatre mappers escrits a mà exposen `name` + `firstSurname`. S'elimina `firstSurname` **per a tots els rols**: a aquestes pantalles l'identificador operatiu és l'`alias` (únic), i `name` és suficient per desambiguar.

| Fitxer | Element |
|--------|---------|
| `apps/api/src/modules/event/attendance.service.ts` | `AttendancePersonRef` + `toAttendanceItem()` |
| `apps/api/src/modules/node-assignment/node-assignment.service.ts` | `AssignmentDetail.person` + `toAssignmentDetail()` |
| `apps/api/src/modules/node-assignment/available-persons.service.ts` | `AvailablePersonDto` |
| `apps/api/src/modules/event-segment/projection.service.ts` | Hereta el canvi via `AssignmentDetail` — sense edició pròpia |

**Sense canvis:** `AttendanceItem.notes` i les notes de segment són notes d'assistència/segment, no `Person.notes`. Els missatges SSE de `sync` contenen correus i noms però els endpoints ja són `@Roles(ADMIN)`. `/auth/me` retorna dades del propi usuari.

### 4.7 Gestió d'usuaris a només `ADMIN`

`GET /api/users` exposa el correu de cada usuari i els cognoms de la persona vinculada, i avui és accessible per `TECHNICAL`. **`apps/api/src/modules/user/user.controller.ts`**: el `@Roles(UserRole.ADMIN, UserRole.TECHNICAL)` de classe passa a `@Roles(UserRole.ADMIN)`. `UserResponseDto` no canvia.

---

## 5. Frontend

### 5.1 `AuthService` — signal `isAdmin`

**`apps/dashboard/src/app/core/auth/services/auth.service.ts`**

```typescript
readonly isAdmin = computed(() => this.userRole() === UserRole.ADMIN);
```

`EventDetailComponent` té avui un `isAdmin` local duplicat; passa a consumir el del servei.

### 5.2 Model `Person`

**`apps/dashboard/src/app/features/persons/models/person.model.ts`** — els camps protegits passen a opcionals, perquè l'API els omet per a `TECHNICAL`:

```typescript
firstSurname?: string;
secondSurname?: string | null;
phone?: string | null;
birthDate?: string | null;
notes?: string | null;
managedBy?: User | null;
```

S'elimina `email` de `Person` i de `UpdatePersonDto` (camp inexistent al backend).

`getFullName()` ja fa `.filter(Boolean)`, per tant amb cognoms absents retorna només el nom. No cal tocar-la.

### 5.3 Llistat de persones

**`apps/dashboard/src/app/shared/models/column-def.model.ts`** — nova propietat opcional:

```typescript
/** Si és cert, la columna només es mostra a usuaris ADMIN. */
adminOnly?: boolean;
```

**`apps/dashboard/src/app/features/persons/components/person-list.component.ts`**

- `phone`, `birthDate` i `notes` es marquen `adminOnly: true`. La columna `email` s'elimina.
- `availableColumns = computed(() => ALL_COLUMNS.filter(c => !c.adminOnly || auth.isAdmin()))`. Es passa a `app-data-table` **i** a `app-column-toggle`, de manera que un `TECHNICAL` no pot ni activar-les.
- `loadVisibleColumns()` intersecciona les claus desades a `localStorage` amb les permeses. Sense això, un admin degradat a `TECHNICAL` (o un `localStorage` editat a mà) seguiria demanant columnes protegides.
- `onSortChangeFromTable` no necessita canvis: les columnes protegides ja no arriben a la taula, i el backend fa fallback si algú força el paràmetre.

### 5.4 Detall de persona

**`person-detail.component.html`** — per a `TECHNICAL`:

- La targeta "Informació personal" conserva `alias`, `name` i `shoulderHeight`, **editables**. Cognoms, telèfon, data de naixement i correu no es renderitzen (ni en lectura ni en edició).
- `notes` surt de la targeta "Informació de la colla".
- La resta de la targeta de colla no canvia: posicions, estat, disponibilitat, acollida i data camisa segueixen sent editables.
- El botó "Promoure a membre" / "Marcar provisional" només es mostra si `auth.isAdmin()` (vegeu §3: la promoció exigeix `firstSurname` i usuari vinculat).

Com que `name` i `alias` segueixen sent editables per a `TECHNICAL`, els seus `Validators.required` no bloquegen mai el desat. `firstSurname` no té validator, així que la seva absència tampoc.

**`person-detail.component.ts` — correcció obligatòria del payload.** `save()` construeix avui el payload amb tots els camps del formulari:

```typescript
firstSurname: raw.firstSurname ?? undefined,
```

`patchForm()` inicialitza aquests controls a `''` quan el valor no arriba, i `'' ?? undefined` avalua a `''`, no a `undefined`. Per tant, en el moment que l'API deixi d'enviar `firstSurname`/`phone`/`notes` a un `TECHNICAL`, prémer "Desar" hi escriuria cadenes buides sobre dades reals. Com que els permisos d'escriptura no canvien, el backend ho acceptaria.

**Solució: llista blanca explícita de claus.** `save()` construeix el payload a partir de dos conjunts de claus declarats, no a partir de tot `getRawValue()`:

```typescript
/** Claus que qualsevol rol amb accés al dashboard pot desar. */
const OPERATIONAL_KEYS = [
  'alias', 'name', 'shoulderHeight', 'isActive', 'isMember', 'isXicalla',
  'availability', 'onboardingStatus', 'shirtDate',
] as const;

/** Claus que només un ADMIN pot desar. */
const PERSONAL_KEYS = [
  'firstSurname', 'secondSurname', 'phone', 'birthDate', 'notes',
] as const;
```

El payload s'omple recorrent `OPERATIONAL_KEYS` i, si `auth.isAdmin()`, també `PERSONAL_KEYS`. **No es pot confiar en marcar els controls com a `disabled`**: `form.getRawValue()` inclou els controls deshabilitats, de manera que les cadenes buides tornarien a sortir i el bug reapareixeria.

### 5.5 Altres components — treure `firstSurname`

| Fitxer | Canvi |
|--------|-------|
| `features/events/components/event-detail/event-detail.component.html` | Columna "Nom" de la taula d'assistència |
| `features/events/components/attendance-edit-modal/attendance-edit-modal.component.html` | Subtítol sota l'àlies |
| `features/pinyes/components/node-popover/node-popover.component.ts` | Línia secundària sota l'àlies |
| `features/pinyes/components/assignment-canvas/assignment-canvas.component.ts` + `.html` | Fallback de `pendingDeletePersonName()` |
| `shared/components/forms/person-search-input/person-search-input.component.html` | Desplegable de resultats |
| `features/persons/components/person-detail/modals/person-link-user-modal.component.html` | Mateix patró que el cercador de persones |
| `features/events/models/attendance.model.ts` | Treure `firstSurname` de la interfície |
| `features/pinyes/models/assignment.model.ts` | Treure `firstSurname` de la interfície |
| `features/pinyes/components/person-panel/person-panel.component.ts` | Treure la referència al camp |
| `features/pinyes/components/assignment-canvas/services/assignment-operations.service.ts` | Treure la referència al camp |

### 5.6 Ruta de configuració d'usuaris

**`config.routes.ts`** — la ruta filla `users` afegeix `canActivate: [rolesGuard(UserRole.ADMIN)]`. Avui no té cap guard propi i hereta el `rolesGuard(TECHNICAL, ADMIN)` del pare a `app.routes.ts`.

Com que `rolesGuard` redirigeix a `/login` en cas de rol insuficient, **cal amagar també els punts d'entrada** o un `TECHNICAL` que hi cliqui semblarà que ha perdut la sessió:

- `features/config/config.component.ts` — la targeta/enllaç "Usuaris".
- `features/home/home.component.html` — l'accés directe a `/config/users`.

---

## 6. Fora d'abast i riscos residuals

### 6.1 Fora d'abast

- Xifratge en repòs dels camps sensibles i registre d'auditoria d'accessos (previstos a `.cursor/rules/muixer-security.mdc`, no en aquesta iteració).
- Exportació de dades (GDPR art. 20) i esborrat dur a petició.
- PWA (`apps/pwa`), encara no implementada. El rol `MEMBER` no té accés al dashboard.

### 6.2 Risc residual acceptat: escriptura

Per decisió de producte els permisos d'escriptura no canvien. Un usuari `TECHNICAL` pot enviar `PATCH /api/persons/:id` amb `phone` o `birthDate` directament contra l'API. La UI no ho ofereix i la correcció de §5.4 evita accidents, però l'endpoint ho accepta. Mitigació futura: validació a `UpdatePersonDto` que rebutgi camps personals si el rol no és `ADMIN`.

### 6.3 Pèrdua funcional acceptada

Els cognoms desapareixen de les pantalles d'assistència i assignació **també per als admins**. És conscient: l'`alias` és únic i és l'identificador que fa servir la colla en aquestes pantalles.

Un `TECHNICAL` deixa de poder promoure persones provisionals a membres regulars i de poder cercar per cognom al cens. Totes dues operacions requereixen dades personals, així que passen a ser feina d'`ADMIN`.

---

## 7. Testing

**Backend**

| Fitxer | Casos |
|--------|-------|
| `person.service.spec.ts` | `findAll`/`findOne` ometen `firstSurname`, `secondSurname`, `phone`, `birthDate`, `notes`, `managedBy` amb rol `TECHNICAL`; els inclouen amb `ADMIN`. Fallback d'ordenació a `alias` per camp personal + `TECHNICAL`. Clàusula de cerca reduïda per `TECHNICAL`. |
| `person.controller.spec.ts` | El rol de `@CurrentUser()` arriba al servei a cada handler. |
| `attendance.service.spec.ts`, `node-assignment.service.spec.ts`, `available-persons.service.spec.ts` | Les respostes no contenen `firstSurname` i la clàusula de cerca no l'inclou. |

**Frontend**

| Fitxer | Casos |
|--------|-------|
| `person-list.component.spec.ts` | Columnes `adminOnly` absents de la taula i del toggle per a `TECHNICAL`; claus de `localStorage` no permeses descartades. |
| `person-detail.component.spec.ts` (nou) | El payload de desat d'un `TECHNICAL` conté només `OPERATIONAL_KEYS`; el d'un `ADMIN` inclou també `PERSONAL_KEYS`. Cas de regressió explícit: amb `firstSurname` absent a la resposta de l'API, el payload d'un `TECHNICAL` **no** hi envia `''`. Botó de promoció ocult per a `TECHNICAL`. |
| `auth.service.spec.ts` | `isAdmin` cert només amb rol `ADMIN`. |

Llindar de cobertura del projecte: 70% (CI amb `--configuration=ci`).

---

## 8. Fitxers afectats

**Backend (8)**

```
modules/person/dto/person-response.dto.ts        # grups + treure email
modules/person/person.service.ts                 # toResponseDto + cerca per rol
modules/person/person.controller.ts              # @CurrentUser
modules/person/constants/person-sort.constants.ts # PERSONAL_SORT_FIELDS + treure email
modules/event/attendance.service.ts              # treure firstSurname (mapper + cerca)
modules/node-assignment/node-assignment.service.ts        # mapper
modules/node-assignment/available-persons.service.ts      # mapper + cerca
modules/user/user.controller.ts                  # @Roles(ADMIN)
```

**Frontend (20)**

```
core/auth/services/auth.service.ts               # isAdmin
shared/models/column-def.model.ts                # adminOnly
shared/components/forms/person-search-input/person-search-input.component.html
features/persons/models/person.model.ts
features/persons/components/person-list.component.ts
features/persons/components/person-detail/person-detail.component.ts
features/persons/components/person-detail/person-detail.component.html
features/events/models/attendance.model.ts
features/events/components/event-detail/event-detail.component.ts   # isAdmin compartit
features/events/components/event-detail/event-detail.component.html
features/events/components/attendance-edit-modal/attendance-edit-modal.component.html
features/pinyes/models/assignment.model.ts
features/pinyes/components/node-popover/node-popover.component.ts
features/pinyes/components/assignment-canvas/assignment-canvas.component.ts + .html
features/pinyes/components/assignment-canvas/services/assignment-operations.service.ts
features/pinyes/components/person-panel/person-panel.component.ts
features/persons/components/person-detail/modals/person-link-user-modal.component.html
features/config/config.routes.ts                 # rolesGuard(ADMIN)
features/config/config.component.ts              # amagar entrada "Usuaris"
features/home/home.component.html                # amagar accés directe a /config/users
```

**Nota sobre `?sortBy=email`:** en treure `'email'` de la llista blanca, la petició passa a retornar 400 en lloc de fer fallback. No afecta ningú: `sortBy` no es persisteix a `localStorage` (només s'hi desen les columnes visibles) i la columna "Correu" desapareix del llistat.

Més els fitxers `.spec.ts` corresponents.
