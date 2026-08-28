# PWA Technical/Admin Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two TECHNICAL/ADMIN-only tools to the PWA: "Passar llista" (mark anyone's attendance for an event) and "Veure com..." (read-only impersonated view of a member's segment placement).

**Architecture:** Reuse the existing staff-only `/events/:id/attendance*` endpoints as-is for roll call. Generalize the existing `GET /me/events/:eventId/segments` endpoint with an optional `personId` query param (role-gated: TECHNICAL/ADMIN may pass any personId, MEMBER stays restricted to their own managed persons) to power the impersonated segment list. The existing `GET /me/events/:eventId/segments/:segmentId/projection` endpoint needs **no backend change** — it already returns the full unfiltered `ProjectionData` for any published segment; `highlightPersonId` is purely a client-side rendering parameter today, so impersonation there is just "pass a different personId as the highlight, from a query param instead of the JWT".

**Tech Stack:** NestJS 11 + TypeORM (API), Angular 21 standalone + Signals + `rxResource` (PWA), DaisyUI v4/Tailwind, `@muixer/ui` (`lib-badge`, `lib-input`), Jest (API), Vitest (PWA).

**Spec:** [docs/superpowers/specs/2026-08-28-pwa-technical-tools-design.md](../specs/2026-08-28-pwa-technical-tools-design.md)

## Global Constraints

- Both new PWA screens/routes are TECHNICAL/ADMIN only — enforce with a route-level `rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)`, since the existing AppShell parent route allows MEMBER too and no child route today overrides it.
- "Veure com..." is **read-only**: no attendance action, no write call is ever issued while impersonating.
- No AuditLog entry for opening the impersonated view (per spec decision).
- No new backend endpoint for attendance — reuse `GET/POST/PUT /events/:id/attendance*` (already `@Roles(TECHNICAL, ADMIN)`).
- UI text in Catalan, code in English, per project language conventions.
- Any new UI must use `@muixer/ui` components (`lib-badge`, `lib-input`) and design tokens — never raw hex or hand-rolled badges/inputs where one already fits.
- `/persons` (`GET`) is `@Roles(TECHNICAL, ADMIN)`-gated already — consistent with restricting the new PWA route the same way, so no backend change needed there either.

---

## File Structure

**Backend (`apps/api/src/modules/me/`):**
- Create `dto/me-segments-query.dto.ts` — `{ personId?: string }`, validated.
- Modify `me.controller.ts` — `findEventSegments` gains `@Query()` param.
- Modify `me.service.ts` — `findEventSegments` gains a `requestedPersonId` param + new private `resolveTargetPersonId` helper.
- Modify `me.service.spec.ts` — new test cases for the role-gated resolution.

**Frontend (`apps/pwa/src/app/features/events/`):**
- Create `services/roll-call.service.ts` — thin wrapper around `/events/:id/attendance*`.
- Create `roll-call/roll-call.component.ts` + `.html` — the "passar llista" screen.
- Create `services/person-lookup.service.ts` — thin wrapper around `GET /persons`.
- Create `watch-as/watch-as.component.ts` + `.html` — person search + that person's segment list.
- Modify `segment-projection/segment-projection.component.ts` + `.html` — accept an optional impersonated personId + display name, show a "Veient com" banner, keep it fully read-only.
- Modify `event-detail/event-detail.component.ts` + `.html` — add a TECHNICAL/ADMIN-only section linking to both new screens.
- Modify `apps/pwa/src/app/app.routes.ts` — two new child routes, each with its own `rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)`.

---

### Task 1: Backend — generalize `GET /me/events/:eventId/segments` with a role-gated `personId`

**Files:**
- Create: `apps/api/src/modules/me/dto/me-segments-query.dto.ts`
- Modify: `apps/api/src/modules/me/me.controller.ts`
- Modify: `apps/api/src/modules/me/me.service.ts`
- Test: `apps/api/src/modules/me/me.service.spec.ts`

**Interfaces:**
- Produces: `MeService.findEventSegments(jwtUser: JwtPayload, eventId: string, requestedPersonId?: string): Promise<MeSegment[]>` (signature change — 3rd param optional, backward compatible for the existing self-only call site).
- Produces: `MeService.resolveTargetPersonId(jwtUser: JwtPayload, requestedPersonId?: string): Promise<string | null>` (private, but future tasks in this plan do not call it directly — noted for completeness).

- [ ] **Step 1: Write the failing test for role-gated resolution**

Add to `apps/api/src/modules/me/me.service.spec.ts` (find the existing `describe('findEventSegments'` block — or create one alongside the existing tests for this method — and add these cases; adjust mock setup to match how `eventSegmentService.findAllByEvent` and `nodeAssignmentRepository.find` are already mocked elsewhere in this file):

```ts
describe('findEventSegments — personId targeting', () => {
  const technicalUser: JwtPayload = { sub: 'tech-user-id', role: UserRole.TECHNICAL } as JwtPayload;
  const memberUser: JwtPayload = { sub: 'member-user-id', role: UserRole.MEMBER } as JwtPayload;
  const eventId = 'event-1';
  const otherPersonId = 'person-not-managed-by-member';

  beforeEach(() => {
    jest.spyOn(service, 'resolveManagedPersons').mockResolvedValue([
      { personId: 'member-own-person-id', displayName: 'Membre', isSelf: true, delegateType: null },
    ]);
    (eventSegmentService.findAllByEvent as jest.Mock).mockResolvedValue([]);
  });

  it('lets TECHNICAL pass an arbitrary personId', async () => {
    await expect(
      service.findEventSegments(technicalUser, eventId, otherPersonId),
    ).resolves.toEqual([]);
  });

  it('lets ADMIN pass an arbitrary personId', async () => {
    const adminUser: JwtPayload = { sub: 'admin-id', role: UserRole.ADMIN } as JwtPayload;
    await expect(
      service.findEventSegments(adminUser, eventId, otherPersonId),
    ).resolves.toEqual([]);
  });

  it('rejects MEMBER passing a personId outside their managed persons', async () => {
    await expect(
      service.findEventSegments(memberUser, eventId, otherPersonId),
    ).rejects.toThrow(ForbiddenException);
  });

  it('lets MEMBER pass a personId that is their own managed person', async () => {
    await expect(
      service.findEventSegments(memberUser, eventId, 'member-own-person-id'),
    ).resolves.toEqual([]);
  });

  it('keeps self-only behavior when no personId is passed', async () => {
    await expect(service.findEventSegments(memberUser, eventId)).resolves.toEqual([]);
  });
});
```

Add `ForbiddenException` and `UserRole` to the test file's imports if not already present (`UserRole` should already be imported from `@muixer/shared`; `ForbiddenException` from `@nestjs/common`).

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test api --testFile=apps/api/src/modules/me/me.service.spec.ts`
Expected: FAIL — `findEventSegments` currently only accepts 2 args, `ForbiddenException` is never thrown, and TypeScript will flag the extra argument as a compile error.

- [ ] **Step 3: Add the query DTO**

Create `apps/api/src/modules/me/dto/me-segments-query.dto.ts`:

```ts
import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class MeSegmentsQueryDto {
  @ApiPropertyOptional({
    description:
      'UUID de la persona a consultar. Ignorat/rebutjat si el sol·licitant és MEMBER i la persona no és seua o d\'un delegat seu. TECHNICAL/ADMIN poden consultar qualsevol persona.',
  })
  @IsOptional()
  @IsUUID('4')
  personId?: string;
}
```

- [ ] **Step 4: Implement `resolveTargetPersonId` and thread it through `findEventSegments`**

In `apps/api/src/modules/me/me.service.ts`, add the import (alongside the existing `@nestjs/common` import line — extend it, don't duplicate):

```ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
```

(Adjust to whatever `@nestjs/common` symbols the file already imports — add `ForbiddenException` to that existing list rather than a second import statement.)

Add `UserRole` to the existing `@muixer/shared` import list in `me.service.ts` if it isn't already imported there.

Replace the current `findEventSegments` body:

```ts
async findEventSegments(
  jwtUser: JwtPayload,
  eventId: string,
  requestedPersonId?: string,
): Promise<MeSegment[]> {
  const segments = await this.eventSegmentService.findAllByEvent(eventId);
  const published = segments.filter((segment) => segment.isPublished);

  const personId = await this.resolveTargetPersonId(jwtUser, requestedPersonId);
  const placementsBySegment = await this.fetchOwnPlacementsBySegment(personId, published);

  return published.map((segment) => ({
    id: segment.id,
    name: segment.name,
    sortOrder: segment.sortOrder,
    instances: segment.instances.map((instance) => ({
      label: instance.label,
      figureMode: instance.figureMode,
      figureTemplate: instance.figureTemplate
        ? { name: instance.figureTemplate.name, hasPinya: instance.figureTemplate.hasPinya }
        : null,
    })),
    myPlacements: placementsBySegment.get(segment.id) ?? [],
  }));
}

/**
 * Resolves which person's placements to show: the caller's own person when no `requestedPersonId`
 * is given; any person for TECHNICAL/ADMIN; only the caller's own managed persons (self + delegates)
 * for MEMBER — otherwise 403, so a member can't view an arbitrary person by editing the URL.
 */
private async resolveTargetPersonId(
  jwtUser: JwtPayload,
  requestedPersonId?: string,
): Promise<string | null> {
  if (!requestedPersonId) {
    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    return managedPersons.find((p) => p.isSelf)?.personId ?? null;
  }

  if (jwtUser.role === UserRole.TECHNICAL || jwtUser.role === UserRole.ADMIN) {
    return requestedPersonId;
  }

  const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
  const isManaged = managedPersons.some((p) => p.personId === requestedPersonId);
  if (!isManaged) {
    throw new ForbiddenException('No autoritzat per consultar esta persona');
  }
  return requestedPersonId;
}
```

Leave `fetchOwnPlacementsBySegment` and `findSegmentProjection` untouched — they need no changes for this task.

- [ ] **Step 5: Wire the controller**

In `apps/api/src/modules/me/me.controller.ts`, add the import:

```ts
import { MeSegmentsQueryDto } from './dto/me-segments-query.dto';
```

Replace the `findEventSegments` handler:

```ts
@Get('events/:eventId/segments')
@ApiOperation({ summary: 'List published segments for an event (titles only)' })
findEventSegments(
  @CurrentUser() user: JwtPayload,
  @Param('eventId', ParseUUIDPipe) eventId: string,
  @Query() query: MeSegmentsQueryDto,
): Promise<MeSegment[]> {
  return this.meService.findEventSegments(user, eventId, query.personId);
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `nx test api --testFile=apps/api/src/modules/me/me.service.spec.ts`
Expected: PASS, all 5 new cases plus every pre-existing test in the file.

- [ ] **Step 7: Run full API test suite for the module to catch regressions**

Run: `nx test api --testFile=apps/api/src/modules/me/me.controller.spec.ts`
Expected: PASS (update the controller spec's call assertion for `findEventSegments` if it asserts the exact 2-arg service call — it now receives a 3rd `undefined` argument when no `personId` query is sent).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/modules/me/dto/me-segments-query.dto.ts apps/api/src/modules/me/me.controller.ts apps/api/src/modules/me/me.service.ts apps/api/src/modules/me/me.service.spec.ts apps/api/src/modules/me/me.controller.spec.ts
git commit -m "feat(api): let TECHNICAL/ADMIN query another person's segment placements"
```

---

### Task 2: PWA — Roll call service

**Files:**
- Create: `apps/pwa/src/app/features/events/services/roll-call.service.ts`
- Test: `apps/pwa/src/app/features/events/services/roll-call.service.spec.ts`

**Interfaces:**
- Produces: `RollCallService.getAttendance(eventId: string, search?: string): Observable<PaginatedResponse<AttendanceItem>>`
- Produces: `RollCallService.createAttendance(eventId: string, payload: { personId: string; status: AttendanceStatus }): Observable<AttendanceCrudResponse>`
- Produces: `RollCallService.updateAttendance(eventId: string, attendanceId: string, payload: { status: AttendanceStatus }): Observable<AttendanceCrudResponse>`
- Produces: `RollCallService.AttendanceItem` and `RollCallService.AttendanceCrudResponse` types (exported from this file — the PWA has no existing shared model for the staff-facing `/events/:id/attendance` shape, so this file defines the minimal shape the roll-call screen needs).

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/src/app/features/events/services/roll-call.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { AttendanceStatus } from '@muixer/shared';
import { RollCallService } from './roll-call.service';
import { environment } from '../../../../environments/environment';

describe('RollCallService', () => {
  let service: RollCallService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), RollCallService],
    });
    service = TestBed.inject(RollCallService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('GETs attendance for an event with an optional search term', () => {
    service.getAttendance('event-1', 'anna').subscribe();
    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/events/event-1/attendance` && r.params.get('search') === 'anna',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { total: 0, page: 1, limit: 100 } });
  });

  it('POSTs a new attendance record', () => {
    service
      .createAttendance('event-1', { personId: 'person-1', status: AttendanceStatus.ASSISTIT })
      .subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/events/event-1/attendance`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ personId: 'person-1', status: AttendanceStatus.ASSISTIT });
    req.flush({ id: 'att-1', status: AttendanceStatus.ASSISTIT });
  });

  it('PUTs an attendance status update', () => {
    service.updateAttendance('event-1', 'att-1', { status: AttendanceStatus.NO_VAIG }).subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/events/event-1/attendance/att-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ status: AttendanceStatus.NO_VAIG });
    req.flush({ id: 'att-1', status: AttendanceStatus.NO_VAIG });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/services/roll-call.service.spec.ts`
Expected: FAIL — `roll-call.service.ts` does not exist yet.

- [ ] **Step 3: Implement the service**

Create `apps/pwa/src/app/features/events/services/roll-call.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AttendanceStatus, PaginatedResponse } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

export interface AttendanceItem {
  id: string;
  status: AttendanceStatus;
  person: {
    id: string;
    alias: string;
    name: string;
    firstSurname: string;
  };
}

export interface AttendanceCrudResponse {
  id: string;
  status: AttendanceStatus;
}

@Injectable({ providedIn: 'root' })
export class RollCallService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/events`;

  getAttendance(eventId: string, search?: string): Observable<PaginatedResponse<AttendanceItem>> {
    let params = new HttpParams().set('limit', '100');
    if (search) params = params.set('search', search);
    return this.http.get<PaginatedResponse<AttendanceItem>>(
      `${this.baseUrl}/${eventId}/attendance`,
      { params },
    );
  }

  createAttendance(
    eventId: string,
    payload: { personId: string; status: AttendanceStatus },
  ): Observable<AttendanceCrudResponse> {
    return this.http.post<AttendanceCrudResponse>(`${this.baseUrl}/${eventId}/attendance`, payload);
  }

  updateAttendance(
    eventId: string,
    attendanceId: string,
    payload: { status: AttendanceStatus },
  ): Observable<AttendanceCrudResponse> {
    return this.http.put<AttendanceCrudResponse>(
      `${this.baseUrl}/${eventId}/attendance/${attendanceId}`,
      payload,
    );
  }
}
```

Confirm `PaginatedResponse` is exported from `@muixer/shared` (it's already used this way in `apps/pwa/src/app/features/events/services/event.service.ts`); if the field name differs from `data`/`meta`, match whatever `PaginatedResponse<T>` actually declares.

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/services/roll-call.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/app/features/events/services/roll-call.service.ts apps/pwa/src/app/features/events/services/roll-call.service.spec.ts
git commit -m "feat(pwa): add roll-call service wrapping the staff attendance endpoints"
```

---

### Task 3: PWA — Roll call component

**Files:**
- Create: `apps/pwa/src/app/features/events/roll-call/roll-call.component.ts`
- Create: `apps/pwa/src/app/features/events/roll-call/roll-call.component.html`
- Test: `apps/pwa/src/app/features/events/roll-call/roll-call.component.spec.ts`

**Interfaces:**
- Consumes: `RollCallService` from Task 2 (`getAttendance`, `createAttendance`, `updateAttendance`), `AttendanceItem` type from Task 2.
- Consumes: `PersonLookupService`? No — roll call searches within the already-fetched attendance list client-side, it does not need person lookup (the event's full attendance list is small; search is a client-side filter over it, matching the spec's "cerca per nom (client-side)").
- Produces: `RollCallComponent` (standalone), routed at `events/:id/roll-call`, input `id = input.required<string>()` (event id, matching the `EventDetailComponent` pattern).

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/src/app/features/events/roll-call/roll-call.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { RollCallComponent } from './roll-call.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

describe('RollCallComponent', () => {
  let fixture: ComponentFixture<RollCallComponent>;
  let rollCallService: jasmine.SpyObj<RollCallService>;

  const attendanceItems: AttendanceItem[] = [
    {
      id: 'att-1',
      status: AttendanceStatus.PENDENT,
      person: { id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' },
    },
    {
      id: 'att-2',
      status: AttendanceStatus.ANIRE,
      person: { id: 'person-2', alias: 'Jordi', name: 'Jordi', firstSurname: 'Ferrer' },
    },
  ];

  beforeEach(async () => {
    rollCallService = jasmine.createSpyObj('RollCallService', [
      'getAttendance',
      'createAttendance',
      'updateAttendance',
    ]);
    rollCallService.getAttendance.and.returnValue(
      of({ data: attendanceItems, meta: { total: 2, page: 1, limit: 100 } }),
    );

    await TestBed.configureTestingModule({
      imports: [RollCallComponent],
      providers: [{ provide: RollCallService, useValue: rollCallService }],
    })
      .overrideComponent(RollCallComponent, { set: { inputs: { id: 'event-1' } } })
      .compileComponents();

    fixture = TestBed.createComponent(RollCallComponent);
    fixture.componentRef.setInput('id', 'event-1');
    fixture.detectChanges();
  });

  it('loads and renders attendance rows for the event', () => {
    expect(rollCallService.getAttendance).toHaveBeenCalledWith('event-1', undefined);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="roll-call-row"]');
    expect(rows.length).toBe(2);
  });

  it('creates a new attendance record when the person has none yet', () => {
    rollCallService.createAttendance.and.returnValue(
      of({ id: 'att-1', status: AttendanceStatus.ASSISTIT }),
    );
    fixture.componentInstance['setStatus'](attendanceItems[0], AttendanceStatus.ASSISTIT);
    expect(rollCallService.createAttendance).toHaveBeenCalledWith('event-1', {
      personId: 'person-1',
      status: AttendanceStatus.ASSISTIT,
    });
  });

  it('updates an existing attendance record', () => {
    rollCallService.updateAttendance.and.returnValue(
      of({ id: 'att-2', status: AttendanceStatus.ASSISTIT }),
    );
    // att-2 already has a non-PENDENT status, so it's treated as an existing record to update.
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(rollCallService.updateAttendance).toHaveBeenCalledWith('event-1', 'att-2', {
      status: AttendanceStatus.ASSISTIT,
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/roll-call/roll-call.component.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 3: Implement the component**

Create `apps/pwa/src/app/features/events/roll-call/roll-call.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, inject, input, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceStatus } from '@muixer/shared';
import { LucideAngularModule, Search } from 'lucide-angular';
import { BadgeComponent } from '@muixer/ui';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PENDENT]: 'Pendent',
  [AttendanceStatus.ANIRE]: 'Vindrà',
  [AttendanceStatus.NO_VAIG]: 'No vindrà',
  [AttendanceStatus.ASSISTIT]: 'Ha assistit',
};

@Component({
  selector: 'app-roll-call',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    BadgeComponent,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './roll-call.component.html',
})
export class RollCallComponent {
  readonly id = input.required<string>();

  protected readonly Search = Search;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statuses = [
    AttendanceStatus.ANIRE,
    AttendanceStatus.NO_VAIG,
    AttendanceStatus.ASSISTIT,
  ];

  private readonly rollCallService = inject(RollCallService);

  protected readonly searchTerm = signal('');
  protected readonly items = signal<AttendanceItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter((item) =>
      `${item.person.alias} ${item.person.name} ${item.person.firstSurname}`
        .toLowerCase()
        .includes(term),
    );
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.rollCallService.getAttendance(this.id()).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected statusLabel(status: AttendanceStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusVariant(status: AttendanceStatus): 'success' | 'error' | 'warning' | 'neutral' {
    switch (status) {
      case AttendanceStatus.ASSISTIT:
        return 'success';
      case AttendanceStatus.NO_VAIG:
        return 'error';
      case AttendanceStatus.ANIRE:
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected setStatus(item: AttendanceItem, status: AttendanceStatus): void {
    const isNewRecord = item.status === AttendanceStatus.PENDENT && item.id.startsWith('pending-');
    const request = isNewRecord
      ? this.rollCallService.createAttendance(this.id(), { personId: item.person.id, status })
      : this.rollCallService.updateAttendance(this.id(), item.id, { status });

    request.subscribe({
      next: (response) => {
        this.items.update((current) =>
          current.map((row) =>
            row.person.id === item.person.id ? { ...row, id: response.id, status: response.status } : row,
          ),
        );
      },
    });
  }
}
```

`isNewRecord` note: `GET /events/:id/attendance` only returns rows that already have an `Attendance` record; a person with no record yet won't appear at all. Since the spec's abast is "tots els membres convocats", the initial `load()` above only shows people who already have a record. Task 3 Step 3b below fixes that gap by merging in event-attendees with no record yet.

- [ ] **Step 3b: Merge in persons with no attendance record yet**

The event's full attendee list (everyone convoked, regardless of whether they've responded) is not what `GET /events/:id/attendance` returns — it only returns existing `Attendance` rows. Check `apps/api/src/modules/event/event.controller.ts` and `attendance.service.ts` `findByEvent`: if it already includes a synthetic `PENDENT` row for every convoked person with no record (confirm by reading `AttendanceService.findByEvent`), no frontend change is needed and this step is a no-op — delete it from your worklog. If it does NOT (i.e., it only returns rows that exist in the `attendances` table), then passar-llista cannot show "everyone" as the spec requires with this endpoint alone, and this is a **scope gap discovered during implementation, not a task placeholder**: stop, re-open the spec's "Abast passar llista" decision with the person who approved the spec, and record the resolution (either the dashboard already has the same limitation and it's accepted, or a small backend change is needed to synthesize PENDENT rows) before continuing Task 3's remaining steps.

- [ ] **Step 4: Implement the template**

Create `apps/pwa/src/app/features/events/roll-call/roll-call.component.html`:

```html
<app-mobile-header title="Passar llista" [showBack]="true" [fallbackRoute]="'/events/' + id()" />

<div class="p-4 space-y-3">
  <label class="input input-bordered flex items-center gap-2">
    <lucide-angular [img]="Search" class="w-4 h-4 opacity-50" />
    <input
      type="text"
      class="grow"
      placeholder="Cerca persona..."
      [(ngModel)]="searchTerm"
    />
  </label>

  @if (isLoading()) {
    <app-skeleton-card [count]="4" />
  } @else if (hasError()) {
    <app-empty-state message="No s'ha pogut carregar l'assistència" />
  } @else if (filteredItems().length === 0) {
    <app-empty-state message="Cap persona trobada" />
  } @else {
    <ul class="space-y-2">
      @for (item of filteredItems(); track item.person.id) {
        <li data-testid="roll-call-row" class="card bg-base-100 shadow-sm p-3 flex flex-row items-center justify-between gap-2">
          <span class="font-medium">{{ item.person.alias }}</span>
          <div class="flex gap-1">
            @for (status of statuses; track status) {
              <lib-badge
                clickable
                size="sm"
                [variant]="item.status === status ? statusVariant(status) : 'neutral'"
                [selected]="item.status === status"
                [ariaLabel]="statusLabel(status) + ' — ' + item.person.alias"
                (clicked)="setStatus(item, status)"
              >{{ statusLabel(status) }}</lib-badge>
            }
          </div>
        </li>
      }
    </ul>
  }
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/roll-call/roll-call.component.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/pwa/src/app/features/events/roll-call/
git commit -m "feat(pwa): add roll-call screen for TECHNICAL/ADMIN"
```

---

### Task 4: PWA — Person lookup service

**Files:**
- Create: `apps/pwa/src/app/features/events/services/person-lookup.service.ts`
- Test: `apps/pwa/src/app/features/events/services/person-lookup.service.spec.ts`

**Interfaces:**
- Produces: `PersonLookupService.search(term: string): Observable<PersonSummaryResult[]>`
- Produces: `PersonSummaryResult` type: `{ id: string; alias: string; name: string; firstSurname: string }`.

- [ ] **Step 1: Write the failing test**

Create `apps/pwa/src/app/features/events/services/person-lookup.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PersonLookupService } from './person-lookup.service';
import { environment } from '../../../../environments/environment';

describe('PersonLookupService', () => {
  let service: PersonLookupService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), PersonLookupService],
    });
    service = TestBed.inject(PersonLookupService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('searches active persons by term with a small result limit', () => {
    service.search('ann').subscribe((results) => {
      expect(results).toEqual([
        { id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' },
      ]);
    });

    const req = httpMock.expectOne(
      (r) =>
        r.url === `${environment.apiUrl}/persons` &&
        r.params.get('search') === 'ann' &&
        r.params.get('limit') === '10' &&
        r.params.get('isActive') === 'true',
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [{ id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' }],
      meta: { total: 1, page: 1, limit: 10 },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/services/person-lookup.service.spec.ts`
Expected: FAIL — service doesn't exist.

- [ ] **Step 3: Implement the service**

Create `apps/pwa/src/app/features/events/services/person-lookup.service.ts`:

```ts
import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { PaginatedResponse } from '@muixer/shared';
import { environment } from '../../../../environments/environment';

export interface PersonSummaryResult {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
}

@Injectable({ providedIn: 'root' })
export class PersonLookupService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/persons`;

  search(term: string): Observable<PersonSummaryResult[]> {
    const params = new HttpParams().set('search', term).set('limit', '10').set('isActive', 'true');
    return this.http
      .get<PaginatedResponse<PersonSummaryResult>>(this.baseUrl, { params })
      .pipe(map((response) => response.data));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/services/person-lookup.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/pwa/src/app/features/events/services/person-lookup.service.ts apps/pwa/src/app/features/events/services/person-lookup.service.spec.ts
git commit -m "feat(pwa): add person lookup service for TECHNICAL/ADMIN search"
```

---

### Task 5: PWA — "Veure com..." (watch-as) component

**Files:**
- Create: `apps/pwa/src/app/features/events/watch-as/watch-as.component.ts`
- Create: `apps/pwa/src/app/features/events/watch-as/watch-as.component.html`
- Test: `apps/pwa/src/app/features/events/watch-as/watch-as.component.spec.ts`
- Modify: `apps/pwa/src/app/features/events/services/event.service.ts` — `findSegments` gains an optional `personId` param.

**Interfaces:**
- Consumes: `PersonLookupService.search` (Task 4), `EventService.findSegments` (modified this task).
- Produces: `WatchAsComponent`, routed at `events/:id/watch-as`, input `id = input.required<string>()`.
- Produces: navigation target for "view this segment as them" — `/events/:eventId/segments/:segmentId` with query params `asPersonId` and `asPersonName` (consumed by Task 6).

- [ ] **Step 1: Modify `EventService.findSegments` to accept an optional `personId`**

In `apps/pwa/src/app/features/events/services/event.service.ts`, change:

```ts
findSegments(eventId: string): Observable<MeSegment[]> {
  return this.http.get<MeSegment[]>(`${this.baseUrl}/${eventId}/segments`);
}
```

to:

```ts
findSegments(eventId: string, personId?: string): Observable<MeSegment[]> {
  let params = new HttpParams();
  if (personId) params = params.set('personId', personId);
  return this.http.get<MeSegment[]>(`${this.baseUrl}/${eventId}/segments`, { params });
}
```

Add `HttpParams` to the existing `@angular/common/http` import in that file. This is backward compatible — every existing call site (`EventDetailComponent`) omits the second argument and keeps today's self-only behavior.

- [ ] **Step 2: Write the failing test for `WatchAsComponent`**

Create `apps/pwa/src/app/features/events/watch-as/watch-as.component.spec.ts`:

```ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { FigureMode } from '@muixer/shared';
import { WatchAsComponent } from './watch-as.component';
import { PersonLookupService } from '../services/person-lookup.service';
import { EventService } from '../services/event.service';

describe('WatchAsComponent', () => {
  let fixture: ComponentFixture<WatchAsComponent>;
  let personLookupService: jasmine.SpyObj<PersonLookupService>;
  let eventService: jasmine.SpyObj<EventService>;

  beforeEach(async () => {
    personLookupService = jasmine.createSpyObj('PersonLookupService', ['search']);
    eventService = jasmine.createSpyObj('EventService', ['findSegments']);

    await TestBed.configureTestingModule({
      imports: [WatchAsComponent],
      providers: [
        { provide: PersonLookupService, useValue: personLookupService },
        { provide: EventService, useValue: eventService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WatchAsComponent);
    fixture.componentRef.setInput('id', 'event-1');
    fixture.detectChanges();
  });

  it('searches persons as the user types', () => {
    personLookupService.search.and.returnValue(
      of([{ id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' }]),
    );
    fixture.componentInstance['onSearchInput']('ann');
    expect(personLookupService.search).toHaveBeenCalledWith('ann');
  });

  it('loads segments scoped to the selected person', () => {
    eventService.findSegments.and.returnValue(
      of([
        {
          id: 'segment-1',
          name: 'Roscana',
          sortOrder: 0,
          instances: [],
          myPlacements: [{ nodeLabel: 'C1', cordon: 1, figureName: null, figureMode: FigureMode.COMPLETA }],
        },
      ]),
    );
    fixture.componentInstance['selectPerson']({
      id: 'person-1',
      alias: 'Anna',
      name: 'Anna',
      firstSurname: 'Puig',
    });
    expect(eventService.findSegments).toHaveBeenCalledWith('event-1', 'person-1');
    expect(fixture.componentInstance['selectedPerson']()?.alias).toBe('Anna');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/watch-as/watch-as.component.spec.ts`
Expected: FAIL — component doesn't exist.

- [ ] **Step 4: Implement the component**

Create `apps/pwa/src/app/features/events/watch-as/watch-as.component.ts`:

```ts
import { Component, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Search } from 'lucide-angular';
import { computeSegmentDisplayName, formatOwnPositionSummary, MeSegment } from '@muixer/shared';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { PersonLookupService, PersonSummaryResult } from '../services/person-lookup.service';
import { EventService } from '../services/event.service';

@Component({
  selector: 'app-watch-as',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAngularModule, MobileHeaderComponent, EmptyStateComponent],
  templateUrl: './watch-as.component.html',
})
export class WatchAsComponent {
  readonly id = input.required<string>();

  protected readonly Search = Search;

  private readonly personLookupService = inject(PersonLookupService);
  private readonly eventService = inject(EventService);
  private debounceTimer?: ReturnType<typeof setTimeout>;

  protected readonly searchTerm = signal('');
  protected readonly results = signal<PersonSummaryResult[]>([]);
  protected readonly selectedPerson = signal<PersonSummaryResult | null>(null);
  protected readonly segments = signal<MeSegment[]>([]);
  protected readonly isLoadingSegments = signal(false);

  protected onSearchInput(value: string): void {
    this.searchTerm.set(value);
    clearTimeout(this.debounceTimer);
    if (!value.trim()) {
      this.results.set([]);
      return;
    }
    this.debounceTimer = setTimeout(() => {
      this.personLookupService.search(value.trim()).subscribe((results) => this.results.set(results));
    }, 300);
  }

  protected selectPerson(person: PersonSummaryResult): void {
    this.selectedPerson.set(person);
    this.results.set([]);
    this.searchTerm.set('');
    this.isLoadingSegments.set(true);
    this.eventService.findSegments(this.id(), person.id).subscribe({
      next: (segments) => {
        this.segments.set(segments);
        this.isLoadingSegments.set(false);
      },
      error: () => this.isLoadingSegments.set(false),
    });
  }

  protected segmentLabel(segment: MeSegment): string {
    return computeSegmentDisplayName(segment.name, segment.instances);
  }

  protected placementSummary(segment: MeSegment): string | null {
    if (segment.myPlacements.length !== 1) return null;
    return formatOwnPositionSummary(segment.myPlacements[0]).sentence;
  }

  protected segmentLink(segment: MeSegment): unknown[] {
    return ['/events', this.id(), 'segments', segment.id];
  }

  protected queryParamsFor(): Record<string, string> {
    const person = this.selectedPerson();
    return person ? { asPersonId: person.id, asPersonName: person.alias } : {};
  }
}
```

Check `formatOwnPositionSummary`'s actual return shape in `libs/shared/src/utils/` before assuming `.sentence` — if it returns a plain `string` instead of an `OwnPositionSummary` object, drop the `.sentence` access and use the return value directly.

- [ ] **Step 5: Implement the template**

Create `apps/pwa/src/app/features/events/watch-as/watch-as.component.html`:

```html
<app-mobile-header title="Veure com..." [showBack]="true" [fallbackRoute]="'/events/' + id()" />

<div class="p-4 space-y-3">
  @if (!selectedPerson()) {
    <label class="input input-bordered flex items-center gap-2">
      <lucide-angular [img]="Search" class="w-4 h-4 opacity-50" />
      <input
        type="text"
        class="grow"
        placeholder="Cerca persona..."
        [value]="searchTerm()"
        (input)="onSearchInput($any($event.target).value)"
      />
    </label>

    @if (results().length > 0) {
      <ul class="menu bg-base-100 rounded-box shadow-sm">
        @for (person of results(); track person.id) {
          <li>
            <a (click)="selectPerson(person)">{{ person.alias }} — {{ person.name }} {{ person.firstSurname }}</a>
          </li>
        }
      </ul>
    }
  } @else {
    <div class="flex items-center justify-between">
      <span class="font-medium">Veient com: {{ selectedPerson()!.alias }}</span>
      <button class="btn btn-sm btn-ghost" (click)="selectedPerson.set(null)">Canviar</button>
    </div>

    @if (isLoadingSegments()) {
      <p class="text-sm opacity-70">Carregant segments...</p>
    } @else if (segments().length === 0) {
      <app-empty-state message="Cap segment publicat per a este event" />
    } @else {
      <ul class="space-y-2">
        @for (segment of segments(); track segment.id) {
          <li class="card bg-base-100 shadow-sm p-3">
            <a [routerLink]="segmentLink(segment)" [queryParams]="queryParamsFor()">
              <div class="font-medium">{{ segmentLabel(segment) }}</div>
              @if (placementSummary(segment); as summary) {
                <div class="text-sm opacity-70">{{ summary }}</div>
              }
            </a>
          </li>
        }
      </ul>
    }
  }
</div>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/watch-as/watch-as.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/app/features/events/watch-as/ apps/pwa/src/app/features/events/services/event.service.ts
git commit -m "feat(pwa): add watch-as person picker for TECHNICAL/ADMIN"
```

---

### Task 6: PWA — impersonated highlight in `SegmentProjectionComponent`

**Files:**
- Modify: `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.ts`
- Modify: `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.html`
- Modify: `apps/pwa/src/app/app.config.ts` (verify only — see Step 1)
- Test: `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.spec.ts`

**Interfaces:**
- Consumes: nothing new from earlier tasks — this task only adds two optional route-bound inputs.
- Produces: `SegmentProjectionComponent.asPersonId = input<string>()`, `SegmentProjectionComponent.asPersonName = input<string>()`, bound from the `asPersonId`/`asPersonName` query params set by Task 5's `queryParamsFor()`.

- [ ] **Step 1: Verify query-param input binding is enabled**

Read `apps/pwa/src/app/app.config.ts`. Find the `provideRouter(...)` call. If its feature list does not already include `withComponentInputBinding()`, add it:

```ts
provideRouter(routes, withComponentInputBinding()),
```

(Import `withComponentInputBinding` from `@angular/router` alongside the other `provideRouter` features already imported there.) If it's already present — which is likely, since `EventDetailComponent`'s `id = input.required<string>()` and `SegmentProjectionComponent`'s existing `eventId`/`segmentId` inputs already rely on path-param binding — this step is a no-op; do not add a duplicate feature.

- [ ] **Step 2: Write the failing test**

In `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.spec.ts` (extend the existing spec file — read it first to match its current mock setup for `ProjectionService`, `LayoutService`, `AuthService`, `Router`), add:

```ts
it('shows the impersonated banner and highlights the impersonated person when asPersonId is set', () => {
  fixture.componentRef.setInput('eventId', 'event-1');
  fixture.componentRef.setInput('segmentId', 'segment-1');
  fixture.componentRef.setInput('asPersonId', 'person-99');
  fixture.componentRef.setInput('asPersonName', 'Jordi Ferrer');
  fixture.detectChanges();

  expect(fixture.componentInstance['highlightPersonId']()).toBe('person-99');
  const banner: HTMLElement = fixture.nativeElement.querySelector('[data-testid="watch-as-banner"]');
  expect(banner?.textContent).toContain('Jordi Ferrer');
});

it('falls back to the caller’s own person when asPersonId is absent', () => {
  fixture.componentRef.setInput('eventId', 'event-1');
  fixture.componentRef.setInput('segmentId', 'segment-1');
  fixture.detectChanges();

  expect(fixture.componentInstance['highlightPersonId']()).toBe(currentUserPersonId);
  const banner = fixture.nativeElement.querySelector('[data-testid="watch-as-banner"]');
  expect(banner).toBeNull();
});
```

(`currentUserPersonId` should reference whatever fixed value the existing spec's `AuthService` mock already sets for `currentUser()?.person?.id` — read the top of the existing spec file for that constant/mock and reuse it rather than inventing a new one.)

- [ ] **Step 3: Run test to verify it fails**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/segment-projection/segment-projection.component.spec.ts`
Expected: FAIL — `asPersonId`/`asPersonName` inputs and the banner don't exist yet.

- [ ] **Step 4: Implement the component change**

In `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.ts`, add the two inputs and change `highlightPersonId`:

```ts
readonly asPersonId = input<string>();
readonly asPersonName = input<string>();
```

Replace:

```ts
protected readonly highlightPersonId = computed(() => this.authService.currentUser()?.person?.id ?? null);
```

with:

```ts
protected readonly highlightPersonId = computed(
  () => this.asPersonId() ?? this.authService.currentUser()?.person?.id ?? null,
);

protected readonly isImpersonating = computed(() => !!this.asPersonId());
```

No other logic in this component needs to change: it never issues a write call (no attendance action lives here today), so "read-only by construction" already holds — impersonation just swaps which id gets highlighted.

- [ ] **Step 5: Implement the template change**

In `apps/pwa/src/app/features/events/segment-projection/segment-projection.component.html`, add the banner near the top (above or alongside the existing back/prev/next HUD — read the current template first to place it without overlapping existing fixed-position elements):

```html
@if (isImpersonating()) {
  <div data-testid="watch-as-banner" class="fixed top-0 inset-x-0 z-50 bg-warning text-warning-content text-center text-sm py-1">
    Veient com: {{ asPersonName() }}
  </div>
}
```

Adjust the `z-50`/positioning classes to whatever the existing HUD elements already use for stacking in this template, so the banner doesn't overlap the back button.

- [ ] **Step 6: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/segment-projection/segment-projection.component.spec.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/app/features/events/segment-projection/ apps/pwa/src/app/app.config.ts
git commit -m "feat(pwa): show impersonated placement banner in segment projection"
```

---

### Task 7: PWA — routes + entry points in `EventDetailComponent`

**Files:**
- Modify: `apps/pwa/src/app/app.routes.ts`
- Modify: `apps/pwa/src/app/features/events/event-detail/event-detail.component.ts`
- Modify: `apps/pwa/src/app/features/events/event-detail/event-detail.component.html`
- Test: `apps/pwa/src/app/features/events/event-detail/event-detail.component.spec.ts`

**Interfaces:**
- Consumes: `RollCallComponent` (Task 3) and `WatchAsComponent` (Task 5) as lazy route targets.
- Consumes: `AuthService.userRole` (existing) and `UserRole` enum (existing, from `@muixer/shared`).

- [ ] **Step 1: Add the two routes**

In `apps/pwa/src/app/app.routes.ts`, add these two entries inside the same nested block as the existing `events/:id` and `events/:eventId/segments/:segmentId` routes:

```ts
{
  path: 'events/:id/roll-call',
  title: 'Passar llista',
  canActivate: [rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)],
  loadComponent: () =>
    import('./features/events/roll-call/roll-call.component').then((m) => m.RollCallComponent),
},
{
  path: 'events/:id/watch-as',
  title: 'Veure com...',
  canActivate: [rolesGuard(UserRole.TECHNICAL, UserRole.ADMIN)],
  loadComponent: () =>
    import('./features/events/watch-as/watch-as.component').then((m) => m.WatchAsComponent),
},
```

Place both entries **before** `events/:id` in the array if this router config matches routes by declaration order and `events/:id` could otherwise shadow a more specific path — check the existing file's ordering convention for `events/:eventId/segments/:segmentId` vs `events/:id` first and follow whatever pattern it already uses.

- [ ] **Step 2: Add the entry-point section to `EventDetailComponent`**

In `apps/pwa/src/app/features/events/event-detail/event-detail.component.ts`, add:

```ts
import { AuthService } from '../../../core/auth/services/auth.service';
import { UserRole } from '@muixer/shared'; // merge into the existing @muixer/shared import list
```

```ts
private readonly authService = inject(AuthService);
protected readonly isStaff = computed(() => {
  const role = this.authService.userRole();
  return role === UserRole.TECHNICAL || role === UserRole.ADMIN;
});
```

- [ ] **Step 3: Add the template section**

In `apps/pwa/src/app/features/events/event-detail/event-detail.component.html`, add a new card near the end of the main content block (after the segments list, inside the existing `@else` branch that has `@let ev = event()!;` in scope):

```html
@if (isStaff()) {
  <div class="card bg-base-100 shadow-sm p-4 space-y-2">
    <h2 class="font-semibold">Eines de tècnic</h2>
    <a class="btn btn-sm btn-outline w-full" [routerLink]="['/events', ev.id, 'roll-call']">
      Passar llista
    </a>
    <a class="btn btn-sm btn-outline w-full" [routerLink]="['/events', ev.id, 'watch-as']">
      Veure com...
    </a>
  </div>
}
```

- [ ] **Step 4: Write/extend the test**

In `apps/pwa/src/app/features/events/event-detail/event-detail.component.spec.ts` (read the existing file first to match its `AuthService`/`EventService` mock setup), add:

```ts
it('shows the staff tools card for TECHNICAL', () => {
  authService.userRole.and.returnValue(UserRole.TECHNICAL);
  fixture.detectChanges();
  const card = fixture.nativeElement.querySelector('a[href*="roll-call"]');
  expect(card).toBeTruthy();
});

it('hides the staff tools card for MEMBER', () => {
  authService.userRole.and.returnValue(UserRole.MEMBER);
  fixture.detectChanges();
  const card = fixture.nativeElement.querySelector('a[href*="roll-call"]');
  expect(card).toBeFalsy();
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `nx test pwa --testFile=apps/pwa/src/app/features/events/event-detail/event-detail.component.spec.ts`
Expected: PASS

- [ ] **Step 6: Manual smoke test**

Run `nx serve api` and `nx serve pwa`. Log in as a TECHNICAL/ADMIN dev user. Open an event with a published segment and at least one other person with an attendance record. Verify:
- The "Eines de tècnic" card appears on `event-detail`, and does not appear when logged in as a MEMBER-only test account.
- "Passar llista" lists attendees, tapping a status badge updates it and persists after reload.
- "Veure com..." finds a person by name, shows their segments with a placement summary, and tapping a segment opens the projection with the "Veient com" banner and the correct node highlighted — with no attendance controls visible.

- [ ] **Step 7: Commit**

```bash
git add apps/pwa/src/app/app.routes.ts apps/pwa/src/app/features/events/event-detail/
git commit -m "feat(pwa): wire roll-call and watch-as entry points into event detail"
```

---

### Task 8: Update docs

**Files:**
- Modify: `CLAUDE.md` (Members PWA section)

- [ ] **Step 1: Add a short mention**

In `CLAUDE.md`'s "Members PWA" section, after the existing description of `SegmentProjectionComponent`, add one sentence noting the TECHNICAL/ADMIN-only additions:

```markdown
TECHNICAL/ADMIN accounts also see an "Eines de tècnic" section on the event detail screen: **Passar llista** (mark any attendee's attendance via the same staff `/events/:id/attendance*` endpoints the Dashboard uses) and **Veure com...** (search any person and open their segment projection read-only, with a "Veient com" banner, via a `personId`-aware `GET /me/events/:eventId/segments`).
```

- [ ] **Step 2: Regenerate the doc map**

Run: `pnpm run docs:map`
Expected: `docs/MAP.md`'s auto-generated section updates PWA file/line counts for the `events` feature; commit the diff alongside the doc change.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/MAP.md
git commit -m "docs: mention PWA technical tools in CLAUDE.md"
```

---

## Self-Review Notes

- **Spec coverage:** Passar llista → Tasks 2–3. Vista suplantada read-only → Tasks 4–6. Ubicació dins event-detail → Task 7. No auditoria / no nous endpoints d'assistència / no QR → honored by omission (no task adds them). Guarda de rol → Task 7 (template) + Global Constraints (route guard).
- **Open risk flagged, not silently resolved:** Task 3 Step 3b calls out that `GET /events/:id/attendance` may only return existing records, not a synthetic PENDENT row per convoked person — this must be checked against the real `AttendanceService.findByEvent` behavior before Task 3 is considered done, since it affects whether "tots els membres convocats" is actually met.
- **Type consistency:** `AttendanceItem`/`AttendanceCrudResponse` (Task 2) used identically in Task 3. `PersonSummaryResult` (Task 4) used identically in Task 5. `MeSegment`/`MeSegmentPlacement` (existing `@muixer/shared` types) used as-is in Task 5, no redefinition. `asPersonId`/`asPersonName` names match between Task 5's `queryParamsFor()` and Task 6's inputs.
