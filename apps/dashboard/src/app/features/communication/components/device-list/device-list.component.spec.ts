import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { DeviceSummary } from '@muixer/shared';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { DeviceListComponent } from './device-list.component';
import { NotificationService } from '../../services/notification.service';

const mockSummary = (): DeviceSummary[] => [
  { person: { id: 'p1', firstName: 'Anna', lastName: 'Ferrer' }, activeDevices: 2, lastPushAt: '2026-08-18T10:00:00.000Z' },
  { person: { id: 'p2', firstName: 'Joan', lastName: 'Puig' }, activeDevices: 1, lastPushAt: null },
  { person: { id: 'p3', firstName: 'Maria', lastName: 'Vila' }, activeDevices: 0, lastPushAt: null },
];

describe('DeviceListComponent', () => {
  let component: DeviceListComponent;
  let fixture: ComponentFixture<DeviceListComponent>;
  let notificationService: { getDeviceSummary: ReturnType<typeof vi.fn> };

  const setup = async (summary: DeviceSummary[] = mockSummary(), fail = false) => {
    notificationService = {
      getDeviceSummary: vi.fn().mockReturnValue(
        fail ? throwError(() => new Error('Network error')) : of(summary),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [DeviceListComponent],
      providers: [
        { provide: NotificationService, useValue: notificationService },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => null } } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DeviceListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  it('loads and displays summary on init', async () => {
    await setup();
    expect(component.summary().length).toBe(3);
    expect(component.loading()).toBe(false);
  });

  it('shows error state when API fails', async () => {
    await setup([], true);
    expect(component.error()).toBe(true);
  });

  it('computes totalDevices correctly', async () => {
    await setup();
    expect(component.totalDevices()).toBe(3);
  });

  it('filters by search text', async () => {
    await setup();
    component.search.set('anna');
    expect(component.filtered().length).toBe(1);
    expect(component.filtered()[0].person.firstName).toBe('Anna');
  });

  it('sorts by devices descending by default', async () => {
    await setup();
    const devices = component.filtered().map((d) => d.activeDevices);
    expect(devices[0]).toBeGreaterThanOrEqual(devices[1]);
  });

  it('sorts by last use when sortBy is lastUse', async () => {
    await setup();
    component.sortBy.set('lastUse');
    const first = component.filtered()[0];
    expect(first.lastPushAt).not.toBeNull();
  });

  it('returns empty filtered list when search does not match', async () => {
    await setup();
    component.search.set('xyznotfound');
    expect(component.filtered().length).toBe(0);
  });
});
