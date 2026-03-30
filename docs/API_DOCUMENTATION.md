# MuixerApp API Documentation

## Arrencada

### Prerequisits

1. Node.js 22+
2. PostgreSQL database (NeonDB recomanat)
3. Variables d'entorn configurades

### Variables d'entorn

Copia `.env.example` a `.env` i configura:

```bash
DATABASE_URL=postgresql://user:pass@host/database?sslmode=require
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:4200
```

### Build i execució

```bash
# 1. Instal·lar dependències
npm install --legacy-peer-deps

# 2. Build shared library
npx nx build shared

# 3. Build API
npx nx build api

# 4. Executar
node dist/apps/api/main.js
```

L'API estarà disponible a `http://localhost:3000/api`

## Swagger/OpenAPI

Documentació interactiva disponible a:

```
http://localhost:3000/api/docs
```

Inclou:
- Tots els endpoints documentats
- Schemas de DTOs
- Exemples de requests/responses
- Possibilitat de provar endpoints directament

## Endpoints

### Persons

- `GET /api/persons` - Llistar membres amb filtres i paginació
- `GET /api/persons/:id` - Obtenir un membre per UUID
- `POST /api/persons` - Crear un nou membre
- `PATCH /api/persons/:id` - Actualitzar un membre
- `DELETE /api/persons/:id` - Eliminar un membre (soft delete)

#### Filtres disponibles

- `search` - Cerca per nom, cognoms o àlies
- `positionId` - Filtrar per posició
- `availability` - Filtrar per disponibilitat (AVAILABLE, INJURED, UNAVAILABLE)
- `isActive` - Filtrar per actius/inactius
- `isXicalla` - Filtrar xicalla
- `isMember` - Filtrar membres oficials
- `page` - Número de pàgina (default: 1)
- `limit` - Elements per pàgina (default: 50, max: 100)

#### Exemple de resposta paginada

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Joan",
      "firstSurname": "Garcia",
      "alias": "joang",
      "email": "joan@example.com",
      "positions": [
        {
          "id": "uuid",
          "name": "Baix",
          "slug": "baix"
        }
      ]
    }
  ],
  "meta": {
    "total": 258,
    "page": 1,
    "limit": 50
  }
}
```

### Positions

- `GET /api/positions` - Llistar totes les posicions
- `GET /api/positions/:id` - Obtenir una posició per UUID
- `POST /api/positions` - Crear una nova posició
- `PATCH /api/positions/:id` - Actualitzar una posició
- `DELETE /api/positions/:id` - Eliminar una posició (soft delete)

### Users

- `GET /api/users` - Llistar usuaris
- `GET /api/users/:id` - Obtenir un usuari per UUID
- `POST /api/users` - Crear un nou usuari
- `PATCH /api/users/:id` - Actualitzar un usuari
- `DELETE /api/users/:id` - Eliminar un usuari (soft delete)

## Validació

Tots els endpoints utilitzen `class-validator` per validar les dades d'entrada:

- Els camps obligatoris retornen 400 si falten
- Els formats incorrectes (email, UUID, etc.) retornen 400
- Els valors fora de rang retornen 400

## Errors

Format estàndard d'error:

```json
{
  "statusCode": 404,
  "message": "Person not found",
  "error": "Not Found"
}
```

Codis d'estat comuns:
- `200` - OK
- `201` - Created
- `204` - No Content (soft delete)
- `400` - Bad Request (validació)
- `404` - Not Found
- `500` - Internal Server Error

## Monitorització

### Interceptor de latència

Cada request es registra automàticament amb:

```
[HTTP] GET /api/persons 200 - 45ms
[HTTP] POST /api/persons 201 - 123ms
[HTTP] GET /api/persons/invalid-uuid 400 - 12ms
```

En cas d'error:

```
[HTTP] GET /api/persons/non-existent 404 - 23ms - Person not found
```

### Logs

Els logs es mostren a la consola del servidor amb colors:
- `LOG` (verd) - Informació general
- `ERROR` (vermell) - Errors
- `WARN` (groc) - Avisos

## Tests

```bash
# Executar tots els tests
npx nx test api

# Executar amb coverage
npx nx test api --coverage

# Executar en mode watch
npx nx test api --watch
```

Tests implementats:
- `PersonService` - 7 tests
- `PositionService` - 4 tests

Total: **11 tests passing**

## Seguretat

### CORS

Configurat per acceptar requests des de `CORS_ORIGIN` (default: `http://localhost:4200`)

### Validació

- Whitelist activat: només els camps definits als DTOs són acceptats
- `forbidNonWhitelisted`: retorna error si s'envien camps no permesos
- `transform`: converteix automàticament els tipus (strings a numbers, etc.)

### SSL

La connexió a NeonDB utilitza SSL per defecte (`sslmode=require`)

## Base de dades

### Sincronització

En mode development, TypeORM sincronitza automàticament l'esquema:

```typescript
synchronize: process.env.NODE_ENV !== 'production'
```

⚠️ **IMPORTANT**: Desactivat en producció per evitar pèrdua de dades.

### Migracions

Per a producció, utilitzar migracions TypeORM (pendent d'implementar).

### Soft Delete

Tots els endpoints DELETE utilitzen soft delete:
- No s'eliminen registres físicament
- Es marca com a inactiu (`isActive = false`)
- Es pot recuperar canviant `isActive = true`

## Desenvolupament

### Estructura de mòduls

```
apps/api/src/
├── app/
│   ├── app.module.ts
│   ├── app.controller.ts
│   └── app.service.ts
├── modules/
│   ├── database/
│   │   ├── database.module.ts
│   │   └── seeds/
│   ├── person/
│   │   ├── person.module.ts
│   │   ├── person.entity.ts
│   │   ├── person.service.ts
│   │   ├── person.controller.ts
│   │   └── dto/
│   ├── position/
│   └── user/
├── common/
│   └── interceptors/
│       └── latency.interceptor.ts
└── main.ts
```

### Afegir un nou mòdul

```bash
# Generar mòdul amb Nx
npx nx g @nx/nest:module modules/nom-modul --project=api

# Generar service
npx nx g @nx/nest:service modules/nom-modul --project=api

# Generar controller
npx nx g @nx/nest:controller modules/nom-modul --project=api
```

### Convencions

- **Entities**: Singular, PascalCase (ex: `Person`, `Position`)
- **DTOs**: Sufixe `Dto` (ex: `CreatePersonDto`, `UpdatePersonDto`)
- **Controllers**: Plural en ruta (ex: `@Controller('persons')`)
- **Services**: Lògica de negoci, no accés directe des del controller
- **Repositories**: Injectats via `@InjectRepository(Entity)`

## Recursos

- [NestJS Documentation](https://docs.nestjs.com)
- [TypeORM Documentation](https://typeorm.io)
- [NeonDB Documentation](https://neon.tech/docs)
- [Swagger/OpenAPI](https://swagger.io/specification/)
