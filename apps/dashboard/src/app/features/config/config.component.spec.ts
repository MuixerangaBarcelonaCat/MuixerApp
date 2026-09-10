import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth.service';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { ConfigComponent } from './config.component';

describe('ConfigComponent', () => {
  let fixture: ComponentFixture<ConfigComponent>;
  const isAdmin = signal(false);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConfigComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        { provide: AuthService, useValue: { isAdmin } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfigComponent);
    isAdmin.set(false);
  });

  it('hides the Users card from a TECHNICAL', () => {
    isAdmin.set(false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Usuaris');
  });

  it('shows the Users card to an ADMIN', () => {
    isAdmin.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usuaris');
  });
});
