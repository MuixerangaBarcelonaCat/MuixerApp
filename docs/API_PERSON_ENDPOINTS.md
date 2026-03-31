# Person API Endpoints

## Resum

API REST per gestionar persones (membres de la colla) amb suport per sincronització des del legacy API i gestió manual d'estat.

**Base URL:** `http://localhost:3000/api`

---

## Endpoints CRUD

### 1. Llistar persones

```http
GET /persons
```

**Query params:**
- `search` (string, opcional): Cerca per alias, nom o cognoms (ILIKE)
- `positionId` (UUID, opcional): Filtrar per posició
- `availability` (enum, opcional): Filtrar per disponibilitat
- `isActive` (boolean, opcional): Filtrar per estat actiu/inactiu
- `isXicalla` (boolean, opcional): Filtrar xicalla
- `isMember` (boolean, opcional): Filtrar membres
- `page` (number, opcional, default: 1): Pàgina actual
- `limit` (number, opcional, default: 50): Resultats per pàgina

**Resposta:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Maria",
      "firstSurname": "Garcia",
      "secondSurname": "López",
      "alias": "Marieta",
      "email": "maria@example.com",
      "phone": "+34 600 123 456",
      "birthDate": "1990-05-15",
      "shoulderHeight": 165,
      "isXicalla": false,
      "isActive": true,
      "isMember": true,
      "availability": "AVAILABLE",
      "onboardingStatus": "COMPLETED",
      "notes": "Notes locals",
      "shirtDate": "2020-01-15",
      "positions": [
        {
          "id": "uuid",
          "name": "Primeres",
          "slug": "primeres",
          "color": "#E53935",
          "zone": "TRONC"
        }
      ],
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "meta": {
    "total": 258,
    "page": 1,
    "limit": 50
  }
}
```

**Exemples:**
```bash
# Totes les persones actives
GET /persons?isActive=true

# Cerca per nom
GET /persons?search=maria

# Persones de primeres
GET /persons?positionId=uuid-primeres

# Xicalla activa
GET /persons?isXicalla=true&isActive=true

# Paginació
GET /persons?page=2&limit=20
```

---

### 2. Obtenir una persona

```http
GET /persons/:id
```

**Params:**
- `id` (UUID, required): ID de la persona

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Maria",
  "firstSurname": "Garcia",
  "alias": "Marieta",
  "positions": [...],
  "createdAt": "2024-01-01T00:00:00Z",
  "updatedAt": "2024-01-15T10:30:00Z"
}
```

**Errors:**
- `404 Not Found`: Persona no trobada

---

### 3. Crear una persona

```http
POST /persons
```

**Body:**
```json
{
  "name": "Joan",
  "firstSurname": "Martínez",
  "secondSurname": "Pérez",
  "alias": "Jonet",
  "email": "joan@example.com",
  "phone": "+34 600 987 654",
  "birthDate": "1995-08-20",
  "shoulderHeight": 175,
  "isXicalla": false,
  "isMember": true,
  "availability": "AVAILABLE",
  "onboardingStatus": "IN_PROGRESS",
  "notes": "Nou membre",
  "positionIds": ["uuid-primeres", "uuid-vents"],
  "mentorId": "uuid-mentor"
}
```

**Camps requerits:**
- `name` (string)
- `firstSurname` (string)
- `alias` (string, max 20 chars, unique)

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Joan",
  "alias": "Jonet",
  "positions": [...],
  "createdAt": "2024-01-20T12:00:00Z",
  "updatedAt": "2024-01-20T12:00:00Z"
}
```

**Errors:**
- `400 Bad Request`: Dades invàlides
- `409 Conflict`: Alias duplicat

---

### 4. Actualitzar una persona

```http
PATCH /persons/:id
```

**Params:**
- `id` (UUID, required): ID de la persona

**Body:** (tots els camps opcionals)
```json
{
  "email": "nou-email@example.com",
  "phone": "+34 600 111 222",
  "availability": "LONG_TERM_UNAVAILABLE",
  "notes": "Notes actualitzades",
  "positionIds": ["uuid-laterals"]
}
```

**Resposta:**
```json
{
  "id": "uuid",
  "email": "nou-email@example.com",
  "updatedAt": "2024-01-21T10:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Persona no trobada
- `400 Bad Request`: Dades invàlides

---

### 5. Eliminar una persona (soft delete)

```http
DELETE /persons/:id
```

**Params:**
- `id` (UUID, required): ID de la persona

**Resposta:**
- `204 No Content` (sense body)

**Errors:**
- `404 Not Found`: Persona no trobada

**Nota:** Això és un soft delete (marca `isActive = false`), no esborra la persona de la base de dades.

---

## Endpoints de Gestió d'Estat

### 6. Desactivar una persona

```http
PATCH /persons/:id/deactivate
```

**Params:**
- `id` (UUID, required): ID de la persona

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Maria",
  "alias": "Marieta",
  "isActive": false,
  "lastSyncedAt": "2026-03-30T10:00:00Z",
  "updatedAt": "2026-03-30T10:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Persona no trobada

**Quan usar:**
- Persona que deixa la colla temporalment
- Baixa mèdica prolongada
- Correcció manual després d'un sync erroni

**Nota:** Actualitza `lastSyncedAt` per registrar la modificació manual.

---

### 7. Activar una persona

```http
PATCH /persons/:id/activate
```

**Params:**
- `id` (UUID, required): ID de la persona

**Resposta:**
```json
{
  "id": "uuid",
  "name": "Maria",
  "alias": "Marieta",
  "isActive": true,
  "lastSyncedAt": "2026-03-30T10:00:00Z",
  "updatedAt": "2026-03-30T10:00:00Z"
}
```

**Errors:**
- `404 Not Found`: Persona no trobada

**Quan usar:**
- Reactivar persona desactivada manualment
- Corregir persona desactivada erròniament pel sync
- Persona que torna després d'una baixa

**Nota:** Actualitza `lastSyncedAt` per registrar la modificació manual.

---

## Enums

### AvailabilityStatus

```typescript
enum AvailabilityStatus {
  AVAILABLE = 'AVAILABLE',
  TEMPORARILY_UNAVAILABLE = 'TEMPORARILY_UNAVAILABLE',
  LONG_TERM_UNAVAILABLE = 'LONG_TERM_UNAVAILABLE',
}
```

### OnboardingStatus

```typescript
enum OnboardingStatus {
  NOT_APPLICABLE = 'NOT_APPLICABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  LOST = 'LOST',
}
```

### FigureZone

```typescript
enum FigureZone {
  PINYA = 'PINYA',
  TRONC = 'TRONC',
  FOLRE = 'FOLRE',
  MANILLES = 'MANILLES',
  POM = 'POM',
  AIXECADOR = 'AIXECADOR',
}
```

---

## Swagger UI

Documentació interactiva disponible a:

```
http://localhost:3000/api/docs
```

---

## Exemples d'ús amb curl

### Llistar persones actives

```bash
curl -X GET "http://localhost:3000/api/persons?isActive=true&page=1&limit=10"
```

### Obtenir una persona

```bash
curl -X GET "http://localhost:3000/api/persons/uuid-persona"
```

### Crear una persona

```bash
curl -X POST "http://localhost:3000/api/persons" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Joan",
    "firstSurname": "Martínez",
    "alias": "Jonet",
    "isMember": true
  }'
```

### Actualitzar disponibilitat

```bash
curl -X PATCH "http://localhost:3000/api/persons/uuid-persona" \
  -H "Content-Type: application/json" \
  -d '{
    "availability": "LONG_TERM_UNAVAILABLE",
    "notes": "Lesió genoll"
  }'
```

### Desactivar una persona

```bash
curl -X PATCH "http://localhost:3000/api/persons/uuid-persona/deactivate"
```

### Activar una persona

```bash
curl -X PATCH "http://localhost:3000/api/persons/uuid-persona/activate"
```

### Eliminar una persona (soft delete)

```bash
curl -X DELETE "http://localhost:3000/api/persons/uuid-persona"
```

---

## Notes Importants

### Camp `legacyId`

El camp `legacyId` és **estrictament intern** i **NO** s'exposa a través de l'API. S'utilitza només per:
- Identificar persones importades del legacy API
- Detectar duplicats durant el sync
- Relacionar dades entre sistemes

Si necessites aquest camp per debugging, requereix un endpoint específic amb permisos d'administrador.

### Camp `lastSyncedAt`

- `null`: Persona creada manualment (no sincronitzada)
- `Date`: Última vegada que es va sincronitzar (automàtica o manual)

### Soft Delete vs Deactivate

- **`DELETE /persons/:id`**: Soft delete (marca `isActive = false`, NO actualitza `lastSyncedAt`)
- **`PATCH /persons/:id/deactivate`**: Desactivació manual (marca `isActive = false`, SÍ actualitza `lastSyncedAt`)

Ambdós fan el mateix efecte (`isActive = false`), però `/deactivate` registra el timestamp de la modificació.

---

## Referències

- **Merge Strategy:** `docs/SYNC_MERGE_STRATEGY.md`
- **Sync Improvements:** `docs/SYNC_IMPROVEMENTS_2026-03-30.md`
- **Entity:** `apps/api/src/modules/person/person.entity.ts`
- **Service:** `apps/api/src/modules/person/person.service.ts`
- **Controller:** `apps/api/src/modules/person/person.controller.ts`
