---
tags: [domini]
---

# SSE Authentication

## Problem

Server-Sent Events (SSE) via `EventSource` API **cannot send custom headers** like `Authorization: Bearer <token>`. This creates a challenge for authenticated SSE endpoints.

## Solution

A **separate Passport strategy**, `jwt-sse` (`SseJwtStrategy`), accepts the token from two sources; the default `jwt` strategy (`JwtStrategy`) used by every other route only ever accepts the Authorization header:

1. **Authorization header** (standard for REST API calls) — both strategies
2. **Query parameter `?token=<jwt>`** (for SSE/EventSource) — `jwt-sse` only

`JwtAuthGuard` (the global guard) picks which strategy runs per route: `@Public()` skips auth entirely, `@SseAuth()` routes to `jwt-sse`, everything else goes through `jwt`.

## Implementation

### Backend: routing to the SSE strategy

```typescript
// apps/api/src/modules/auth/guards/jwt-auth.guard.ts
canActivate(context: ExecutionContext) {
  const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [...]);
  if (isPublic) return true;

  const isSse = this.reflector.getAllAndOverride<boolean>(IS_SSE_KEY, [...]);
  if (isSse) return this.sseGuard.canActivate(context); // AuthGuard('jwt-sse')

  return super.canActivate(context); // AuthGuard('jwt')
}
```

```typescript
// apps/api/src/modules/auth/strategies/jwt-sse.strategy.ts
jwtFromRequest: ExtractJwt.fromExtractors([
  ExtractJwt.fromAuthHeaderAsBearerToken(),
  extractSseQueryToken, // reads req.query.token
]),
```

A route opts in with `@SseAuth()` (`decorators/sse-auth.decorator.ts`), never by touching `JwtStrategy` itself — that strategy stays header-only for every non-SSE route.

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

1. **Short-lived tokens** — access tokens expire in 15 minutes (`JWT_ACCESS_TTL=900`)
2. **HTTPS only in production** — prevents token interception
3. **Scoped to SSE routes only** — `?token=` is accepted **only** on routes marked `@SseAuth()`; every other endpoint (including refresh-token cookies, `sameSite: 'lax'`, see [[AUTH_FLOW]]) rejects it
4. **CORS restrictions** — only allowed origins can call SSE endpoints

## Affected Endpoints

`sync.controller.ts` (ADMIN role, `@SseAuth()` at controller level):

- `GET /api/sync/persons?token=<jwt>`
- `GET /api/sync/events?token=<jwt>`
- `GET /api/sync/events/:eventId/attendance?token=<jwt>`
- `GET /api/sync/all?token=<jwt>`

`me.controller.ts` (MEMBER/TECHNICAL/ADMIN, `@SseAuth()` on the single method so the
controller's other routes keep header-only auth):

- `GET /api/me/events/:eventId/changes?token=<jwt>` — live figure-data changes for one
  event, so an open projection refetches instead of waiting for a manual reload. Each
  message is narrowed per-subscriber to **published segments only**
  (`MeService.narrowSegmentChangeForMember`), matching the `onlyPublished` scope of the
  projection endpoint — otherwise the stream would leak the ids of unpublished segments.
  Carries a `ping` heartbeat every 30s; those arrive as a typed SSE event, so a client's
  `onmessage` only ever sees real changes.

`event-segment.controller.ts` (TECHNICAL/ADMIN, `@SseAuth()` on the single method):

- `GET /api/events/:eventId/segments/changes?token=<jwt>` — same live figure-data
  stream as above, unfiltered (TECHNICAL/ADMIN already see every segment). Consumed by
  the dashboard's `ProjectionViewComponent` when used standalone; the embedded copy
  inside the segment workspace's Previsualitza tab does not open its own connection —
  the workspace is meant to own one shared connection for the whole tab set (not yet
  built, see [docs/PINYES_MODULE.md](PINYES_MODULE.md)).

---

*Veïns: [[AUTH_FLOW]] · [[SYNC_ARCHITECTURE]] · [[MAP]]*
