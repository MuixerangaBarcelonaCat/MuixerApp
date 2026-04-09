# SSE Authentication

## Problem

Server-Sent Events (SSE) via `EventSource` API **cannot send custom headers** like `Authorization: Bearer <token>`. This creates a challenge for authenticated SSE endpoints.

## Solution

The JWT strategy accepts tokens from **two sources**:

1. **Authorization header** (standard for REST API calls)
2. **Query parameter `?token=<jwt>`** (for SSE/EventSource)

## Implementation

### Backend: JWT Strategy

```typescript
// apps/api/src/modules/auth/strategies/jwt.strategy.ts
jwtFromRequest: ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  (req: Request) => {
    // Support SSE via query parameter
    const token = req.query?.['token'] as string | undefined;
    return token ?? null;
  },
]),
```

### Frontend: EventSource with Token

```typescript
// apps/dashboard/src/app/features/events/components/event-detail/event-detail.component.ts
const token = this.authService.getAccessToken();
const url = `${environment.apiUrl}/sync/events/${ev.id}/attendance?token=${encodeURIComponent(token)}`;
this.syncEventSource = new EventSource(url);
```

## Testing with curl

```bash
# 1. Login to get access token
curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password","clientType":"DASHBOARD"}' \
  -c cookies.txt

# Extract accessToken from response (jq required)
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"password","clientType":"DASHBOARD"}' \
  -s | jq -r '.accessToken')

# 2. Call SSE endpoint with token as query param
curl "http://localhost:3000/api/sync/events/60992fc5-844f-4c25-8c34-20fe0bac2e22/attendance?token=$TOKEN" \
  -H 'Accept: text/event-stream' \
  -N
```

## Security Considerations

### Query Parameter Risks

Passing tokens via query parameters has security implications:

1. **Logged in server logs** — tokens may appear in access logs
2. **Browser history** — tokens stored in browser history
3. **Referer headers** — tokens may leak via Referer header

### Mitigations

1. **Short-lived tokens** — access tokens expire in 15 minutes (JWT_ACCESS_TTL=900)
2. **HTTPS only in production** — prevents token interception
3. **SameSite cookies** — refresh tokens use `sameSite: 'strict'`
4. **CORS restrictions** — only allowed origins can call SSE endpoints

### Alternative: Cookie-Based Auth

For higher security, consider implementing cookie-based access tokens:

```typescript
// Set access token as HttpOnly cookie
res.cookie('access_token', accessToken, {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 15 * 60 * 1000, // 15 minutes
});

// JWT Strategy extracts from cookie
jwtFromRequest: ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  (req: Request) => req.cookies?.['access_token'] ?? null,
]),
```

This eliminates query parameter risks but requires:
- Frontend to handle cookie-based auth
- CORS `credentials: true` configuration
- More complex token refresh logic

## Affected Endpoints

All sync endpoints require ADMIN role and support query param auth:

- `GET /api/sync/persons?token=<jwt>`
- `GET /api/sync/events?token=<jwt>`
- `GET /api/sync/events/:eventId/attendance?token=<jwt>`
- `GET /api/sync/all?token=<jwt>`
