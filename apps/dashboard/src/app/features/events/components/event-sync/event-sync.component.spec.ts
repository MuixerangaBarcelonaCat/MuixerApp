import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { describe, beforeEach, afterEach, it, expect, vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { EventSyncComponent } from './event-sync.component';
import { AuthService } from '../../../../core/auth/services/auth.service';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  closed = false;

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  close() {
    this.closed = true;
  }
}

describe('EventSyncComponent', () => {
  let fixture: ComponentFixture<EventSyncComponent>;
  let component: EventSyncComponent;
  let originalEventSource: typeof EventSource;

  beforeEach(async () => {
    originalEventSource = globalThis.EventSource;
    MockEventSource.instances = [];
    (globalThis as unknown as { EventSource: unknown }).EventSource = MockEventSource;

    const mockAuthService = {
      getAccessToken: vi.fn().mockReturnValue('token-1'),
    };
    const mockRouter = { navigate: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [EventSyncComponent],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: Router, useValue: mockRouter },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventSyncComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    (globalThis as unknown as { EventSource: unknown }).EventSource = originalEventSource;
  });

  it('closes the EventSource when the component is destroyed mid-sync', () => {
    component.startSync();
    const source = MockEventSource.instances[0];
    expect(source.closed).toBe(false);

    fixture.destroy();

    expect(source.closed).toBe(true);
  });
});
