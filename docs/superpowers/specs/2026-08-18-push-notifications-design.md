# Push Notifications — Design Spec

**Date:** 2026-08-18
**Status:** Approved
**Scope:** API + Dashboard + PWA

---

## Summary

Implement Web Push (VAPID) notifications for MuixerApp. Admins/technicals send push notifications to members via the Dashboard. Members receive native OS notifications on subscribed devices via the PWA.

---

## Decisions

| Decision | Choice |
|----------|--------|
| Provider | Web Push (VAPID) — W3C standard, no third-party dependency |
| Architecture | EventEmitter async dispatch (no Redis/BullMQ) |
| Subscription owner | User (not Person) — only authenticated accounts can subscribe |
| Multi-device | Yes, multiple subscriptions per User |
| History | Fire-and-forget (no delivery log) |
| In-app center | No — native OS push only |
| Scheduled push | Cron every minute checks publishedAt for deferred news |
| Cleanup | Automatic: 410 Gone → soft disable; daily cron purges stale |

---

## 1. Data Model

### Entity: `PushSubscription`

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID PK | |
| `user` | ManyToOne → User | Owner. A User can have N subscriptions |
| `endpoint` | varchar(500) UNIQUE | Push service URL (Chrome/Firefox/Safari) |
| `keys` | jsonb | `{ p256dh: string, auth: string }` |
| `userAgent` | varchar(255) nullable | Browser/device info for admin display |
| `isActive` | boolean default true | Soft disable without deleting |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `lastUsedAt` | timestamp nullable | Updated on each successful push delivery |

**Indexes:**
- `userId` (FK, find subscriptions for a user)
- `endpoint` (UNIQUE)
- Composite: `[isActive, userId]` (common query pattern)

**Invariants:**
- `endpoint` globally unique (one endpoint = one browser on one device)
- 410 Gone from push service → `isActive = false` immediately
- Max 10 active subscriptions per User (abuse prevention)

### Entity: `News` — new fields

| Field | Type | Notes |
|-------|------|-------|
| `sendPush` | boolean default false | Admin opted to send push for this news |
| `pushSentAt` | timestamp nullable | When push was dispatched. null = pending or not requested |

---

## 2. API — Module `push-notification`

### Module structure

```
apps/api/src/modules/push-notification/
├── push-notification.module.ts
├── push-notification.controller.ts     # Admin endpoints (send push)
├── push-notification.service.ts        # Dispatch logic + EventEmitter
├── push-notification-cron.service.ts   # Scheduled news push + subscription cleanup
├── push-subscription.controller.ts     # Member endpoints (register/remove subscription)
├── push-subscription.service.ts        # CRUD subscriptions
├── push-sender.service.ts              # web-push wrapper (provider pattern)
├── entities/
│   └── push-subscription.entity.ts
├── dto/
│   ├── register-subscription.dto.ts
│   ├── send-notification.dto.ts
│   └── notification-target.dto.ts
└── events/
    └── push-requested.event.ts
```

### Endpoints

#### Member (via `/me`):

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `POST` | `/me/push-subscriptions` | MEMBER+ | Register subscription (endpoint + keys) |
| `DELETE` | `/me/push-subscriptions` | MEMBER+ | Unsubscribe current device (by endpoint in body) |
| `GET` | `/me/push-subscriptions/status` | MEMBER+ | Returns whether the user has any active subscription |

#### Admin (via `/notifications`):

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `POST` | `/notifications/send` | TECHNICAL, ADMIN | Send push notification |
| `GET` | `/notifications/vapid-public-key` | Public | Returns VAPID public key for client subscription |

#### Admin device management:

| Method | Route | Role | Description |
|--------|-------|------|-------------|
| `GET` | `/push-subscriptions/summary` | TECHNICAL, ADMIN | List persons with active device count and last push date |

### DTOs

**`RegisterSubscriptionDto`:**
```typescript
{
  endpoint: string;       // Push service URL (validated: must be HTTPS)
  keys: {
    p256dh: string;       // Client public key
    auth: string;         // Auth secret
  };
  userAgent?: string;     // Optional browser info
}
```

**`SendNotificationDto`:**
```typescript
{
  title: string;          // Max 100 chars
  body: string;           // Max 500 chars
  url?: string;           // Deep link URL opened on click
  target: {
    type: 'ALL' | 'EVENT_ATTENDANCE' | 'PERSON';
    eventId?: string;            // Required if type = EVENT_ATTENDANCE
    attendanceFilter?: 'PENDENT' | 'ANIRE' | 'NO_VAIG';
    personIds?: string[];        // Required if type = PERSON
  };
}
```

### Send flow

```
Admin POST /notifications/send
  → Controller validates DTO + @Roles(TECHNICAL, ADMIN)
  → PushNotificationService.send(dto)
    → Resolve target → Person IDs
    → Find User IDs via Person relation
    → eventEmitter.emit('push.requested', { userIds, payload })
    → Return 202 Accepted

Listener (async, outside request cycle):
  → PushNotificationService.handlePushRequested(event)
    → Find PushSubscription[] WHERE user.id IN (...) AND isActive = true
    → For each subscription: PushSenderService.send(subscription, payload)
      → 201: update lastUsedAt
      → 410 Gone / 404: set isActive = false
      → 429 / 5xx: log warning (no retry)
```

### Push sender provider pattern

```typescript
interface PushProvider {
  send(subscription: PushSubscriptionData, payload: NotificationPayload): Promise<PushResult>;
}

// Production: WebPushProvider (uses `web-push` npm package)
// Development: ConsolePushProvider (logs to console)
```

Controlled by env var: `PUSH_PROVIDER=console | web-push`

### Cron jobs

**`PushNotificationCronService`:**

1. **Scheduled news push** — `@Cron('*/1 * * * *')`:
   - Find News WHERE `sendPush = true` AND `publishedAt <= now()` AND `pushSentAt IS NULL`
   - For each: emit push event + set `pushSentAt = now()`

2. **Subscription cleanup** — `@Cron('0 3 * * *')` (daily at 03:00):
   - Delete WHERE `isActive = false` AND `updatedAt < now() - 30 days`
   - Delete WHERE `lastUsedAt IS NULL` AND `createdAt < now() - 90 days`

---

## 3. PWA — Service Worker & Subscription UX

### Service Worker strategy

**Custom SW wrapping ngsw:** Single service worker file `custom-sw.js` that imports Angular's generated ngsw for caching and adds push event handlers.

```javascript
// custom-sw.js
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const { title, body, url, icon } = data;

  event.waitUntil(
    self.registration.showNotification(title || 'MuixerApp', {
      body: body || '',
      icon: icon || '/icons/icon-192.png',
      badge: '/icons/badge-72.png',
      data: { url },
      vibrate: [200, 100, 200],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Reuse existing PWA window if open
      const existing = windowClients.find((c) => c.visibilityState === 'visible');
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return clients.openWindow(url);
    })
  );
});
```

**Registration:** Change `ServiceWorkerModule` config to register `custom-sw.js` instead of `ngsw-worker.js`.

### Angular service: `PushSubscriptionService`

**Signals:**
- `pushSupported: Signal<boolean>` — browser supports PushManager
- `pushPermission: Signal<'default' | 'granted' | 'denied'>` — current permission state
- `isSubscribed: Signal<boolean>` — has active subscription on backend

**Methods:**
- `requestPermissionAndSubscribe()` — request permission → subscribe → POST to backend
- `unsubscribe()` — unsubscribe from push manager → DELETE on backend
- `checkStatus()` — GET /me/push-subscriptions/status

### UX Flow

**First login after install:**
```
AuthService detects: login OK + pushSupported + permission === 'default'
  → Show PushPermissionBannerComponent (non-intrusive bottom banner):
    "Activa les notificacions per saber quan hi ha assaig"
    [Activar] [Ara no]

  → "Activar":
    → Notification.requestPermission()
    → If granted: subscribe + POST to backend
    → Banner disappears

  → "Ara no":
    → Save flag to localStorage (don't show again for 7 days)
    → Banner disappears
```

**Profile → Notifications section:**
```
Toggle: Notificacions push [ON/OFF]
  → If ON and permission === 'denied':
    "Has bloquejat les notificacions. Canvia-ho a la configuració del navegador."
  → OFF button: unsubscribe flow
```

### New files in `apps/pwa/`

```
src/
├── custom-sw.js                           # SW wrapper (ngsw + push handlers)
├── app/
│   ├── core/services/
│   │   └── push-subscription.service.ts   # Push subscription logic
│   ├── shared/components/
│   │   └── push-permission-banner/
│   │       ├── push-permission-banner.component.ts
│   │       └── push-permission-banner.component.html
│   └── features/profile/
│       └── components/
│           └── push-settings/
│               ├── push-settings.component.ts
│               └── push-settings.component.html
```

---

## 4. Dashboard — Notification Management UI

### News Editor — Push toggle

Added to `NewsEditorComponent` form:

```
☑ Enviar notificació push als membres
```

- Checked by default on new news
- Disabled if news already sent push (`pushSentAt != null`)
- Saved as `sendPush` field in CreateNewsDto / UpdateNewsDto

### News List — Push indicator

- 🔔 icon if `sendPush = true`
- "Push enviada" + timestamp if `pushSentAt != null`
- "Push pendent (programada)" if `sendPush = true` AND `pushSentAt = null` AND `publishedAt` is future

### Notification send page

**Route:** `/communication/notifications`

**Component: `NotificationSendComponent`**

Form:
```
Títol:        [________________________] (max 100)
Missatge:     [________________________] (max 500)

Destinataris: ○ Tothom
              ○ Per assistència a un event
                → [Select event ▼]
                → [Select filtre: Pendent / Vinc / No vinc ▼]

URL (opcional): [________________________]

[Enviar notificació]
```

### Device management page

**Route:** `/communication/notifications/devices`

**Component: `DeviceListComponent`**

| Column | Content |
|--------|---------|
| Persona | Full name (link to profile) |
| Dispositius actius | Count of active subscriptions |
| Últim ús | Last successful push date |
| Accions | "Enviar push" button (bell icon) |

**Features:**
- Grouped by person (admin doesn't see raw endpoints)
- Search filter by name
- Sort by device count or last use
- Badge if person has 0 active devices

**"Enviar push" to specific person:** Opens lightweight dialog:
```
Enviar notificació a [Person Name]

Títol:    [________________________]
Missatge: [________________________]
URL:      [________________________] (optional)

[Cancel·lar] [Enviar]
```

### Updated routes

```
/communication                              → Hub (update notification card)
/communication/news                         → News list (existing, add push indicators)
/communication/news/new                     → Editor + push toggle (existing, extend)
/communication/news/:id/edit                → Editor + push toggle (existing, extend)
/communication/notifications                → Send push form (NEW)
/communication/notifications/devices        → Device list per person (NEW)
```

---

## 5. Shared Library (`libs/shared`)

### New enum: `NotificationTargetType`

```typescript
export enum NotificationTargetType {
  ALL = 'ALL',
  EVENT_ATTENDANCE = 'EVENT_ATTENDANCE',
  PERSON = 'PERSON',
}
```

### New interfaces

```typescript
export interface PushSubscriptionKeys {
  p256dh: string;
  auth: string;
}

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

export interface NotificationTarget {
  type: NotificationTargetType;
  eventId?: string;
  attendanceFilter?: AttendanceStatus;
  personIds?: string[];
}

export interface PushSubscriptionStatus {
  isSubscribed: boolean;
  deviceCount: number;
}

export interface DeviceSummary {
  person: { id: string; firstName: string; lastName: string };
  activeDevices: number;
  lastPushAt: string | null;
}
```

---

## 6. Configuration & DevOps

### New environment variables (`.env.example`)

```env
# Push Notifications (Web Push VAPID)
PUSH_PROVIDER=console              # 'console' (dev) or 'web-push' (production)
VAPID_PUBLIC_KEY=                   # Generated once with: npx web-push generate-vapid-keys
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:admin@muixerangadebarcelona.cat
```

### New npm dependency

```
web-push: ^3.x    # Web Push protocol library with VAPID support
```

### Database migrations

1. `CreatePushSubscriptionsTable` — creates `push_subscriptions` table
2. `AddPushFieldsToNews` — adds `sendPush` (boolean) and `pushSentAt` (timestamp nullable) to `news` table

### PWA build config

- `custom-sw.js` added to `project.json` assets so it's copied to output
- `ServiceWorkerModule` config changed to register `custom-sw.js`

---

## 7. Security

| Concern | Mitigation |
|---------|------------|
| VAPID private key exposure | Backend only, never sent to client. Client gets public key via dedicated endpoint |
| Subscription without Person | User must have linked Person (guard returns 403 otherwise) |
| Subscription abuse | Max 10 active subscriptions per User |
| Endpoint validation | Must be HTTPS, domain allowlist: `fcm.googleapis.com`, `updates.push.services.mozilla.com`, `web.push.apple.com` |
| Admin-only send | `@Roles(TECHNICAL, ADMIN)` on all send endpoints |
| VAPID public key endpoint | `@Public()` — needed by client before auth in some flows |

---

## 8. Edge Cases

| Case | Behavior |
|------|----------|
| User without linked Person | Cannot subscribe (403) |
| Browser doesn't support push | Banner hidden, toggle disabled with explanatory message |
| Permission "denied" | Profile section shows instructions to change in browser settings |
| Duplicate endpoint (same device re-subscribes) | Upsert: update keys if changed, don't create duplicate |
| News edited after push sent | Does not re-send (`pushSentAt != null` blocks) |
| Send push with 0 active subscriptions | 200 OK with warning message: "Cap dispositiu subscrit per als destinataris seleccionats" |
| Push fails for all devices | Log warning, no retry (fire-and-forget) |
| User deleted/deactivated | Cascade: subscriptions deleted with User |
| Scheduled news with push, then unpublished before time | `sendPush` stays true but if `publishedAt` is set to null/future, cron won't pick it up |

---

## 9. Testing Strategy

### Backend (Jest)

| File | Coverage |
|------|----------|
| `push-subscription.service.spec.ts` | CRUD, dedup by endpoint, soft delete on 410, max 10 limit |
| `push-notification.service.spec.ts` | Target resolution (ALL, EVENT_ATTENDANCE, PERSON), event emit |
| `push-sender.service.spec.ts` | Mock web-push, handle 201/410/429/5xx responses |
| `push-notification-cron.service.spec.ts` | Find pending news, mark pushSentAt, cleanup logic |

### Integration test (testcontainers)

- Full flow: register subscription → send notification → verify PushSenderService called with correct params → verify lastUsedAt updated
- Target resolution: create persons + attendances, send with EVENT_ATTENDANCE filter, verify only correct subscriptions contacted

### Frontend (Vitest)

| File | Coverage |
|------|----------|
| `push-subscription.service.spec.ts` (PWA) | Mock PushManager, Notification.permission, HTTP calls |
| `push-permission-banner.component.spec.ts` | Show/hide logic, localStorage timer |
| `notification-send.component.spec.ts` (Dashboard) | Form validation, target type switching |
| `device-list.component.spec.ts` (Dashboard) | Render list, send to individual |

---

## 10. Out of Scope (future)

- In-app notification center (bell icon with badge)
- Category-based opt-in/opt-out (only events, only news, etc.)
- Automatic attendance reminders (cron-triggered)
- FCM migration (provider pattern makes this pluggable)
- Push analytics (delivery rates, click-through)
- Rich notifications (images, action buttons)
