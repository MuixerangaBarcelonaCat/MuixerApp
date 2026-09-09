import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { AppShellComponent } from './app-shell.component';
import { AuthService } from '../../auth/services/auth.service';
import { LayoutService } from '../../services/layout.service';
import { PushSubscriptionService } from '../../services/push-subscription.service';

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  let layoutService: LayoutService;
  let syncOnStartup: ReturnType<typeof vi.fn>;

  async function setup() {
    syncOnStartup = vi.fn().mockResolvedValue(undefined);
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { hasLinkedPerson: () => true, requiresPrivacyConsent: () => false },
        },
        {
          provide: PushSubscriptionService,
          useValue: {
            syncOnStartup,
            pushSupported: () => false,
            pushPermission: () => 'default',
            isSubscribed: () => false,
            isDismissedRecently: () => false,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShellComponent);
    layoutService = TestBed.inject(LayoutService);
    fixture.detectChanges();
  }

  it('syncs push subscription state on startup', async () => {
    await setup();
    expect(syncOnStartup).toHaveBeenCalledTimes(1);
  });

  it('shows the bottom tab bar by default', async () => {
    await setup();
    expect(fixture.nativeElement.querySelector('app-bottom-tab-bar')).toBeTruthy();
  });

  it('hides the bottom tab bar while a fullscreen view (e.g. segment projection) is active', async () => {
    await setup();
    layoutService.isFullscreen.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-bottom-tab-bar')).toBeNull();
  });

  it('restores the bottom tab bar once fullscreen exits', async () => {
    await setup();
    layoutService.isFullscreen.set(true);
    fixture.detectChanges();
    layoutService.isFullscreen.set(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-bottom-tab-bar')).toBeTruthy();
  });
});
