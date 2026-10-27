import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/services/auth.service';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { ConfigComponent } from './config.component';

describe('ConfigComponent', () => {
  const render = (isAdmin: boolean) => {
    TestBed.configureTestingModule({
      imports: [ConfigComponent],
      providers: [allLucideIconsProvider, provideRouter([]), { provide: AuthService, useValue: { isAdmin: signal(isAdmin) } }],
    });
    const fixture = TestBed.createComponent(ConfigComponent);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  };

  it('links an ADMIN to the colla settings', () => {
    expect(render(true)).toContain('Configuració de la colla');
  });

  it('hides the colla settings from a TECHNICAL', () => {
    expect(render(false)).not.toContain('Configuració de la colla');
  });
});
