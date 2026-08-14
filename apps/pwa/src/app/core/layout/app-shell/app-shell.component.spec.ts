import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppShellComponent } from './app-shell.component';
import { AuthService } from '../../auth/services/auth.service';
import { LayoutService } from '../../services/layout.service';

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  let layoutService: LayoutService;

  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: { hasLinkedPerson: () => true, requiresPrivacyConsent: () => false },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppShellComponent);
    layoutService = TestBed.inject(LayoutService);
    fixture.detectChanges();
  }

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
