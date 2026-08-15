import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { MobileHeaderComponent } from './mobile-header.component';

describe('MobileHeaderComponent', () => {
  let fixture: ComponentFixture<MobileHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MobileHeaderComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileHeaderComponent);
  });

  it('renders the title', () => {
    fixture.componentRef.setInput('title', 'Perfil');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Perfil');
  });

  it('does not render a back button by default', () => {
    fixture.componentRef.setInput('title', 'Perfil');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button[aria-label="Torna enrere"]')).toBeFalsy();
  });

  it('renders a back button and navigates back when showBack is true', () => {
    fixture.componentRef.setInput('title', 'Perfil');
    fixture.componentRef.setInput('showBack', true);
    fixture.detectChanges();

    const backButton = fixture.nativeElement.querySelector(
      'button[aria-label="Torna enrere"]',
    ) as HTMLButtonElement;
    expect(backButton).toBeTruthy();
  });

  it('falls back to fallbackRoute when there is no browser history to go back to', () => {
    fixture.componentRef.setInput('title', 'Perfil');
    fixture.componentRef.setInput('showBack', true);
    fixture.componentRef.setInput('fallbackRoute', '/home');
    fixture.detectChanges();

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);

    const backButton = fixture.nativeElement.querySelector(
      'button[aria-label="Torna enrere"]',
    ) as HTMLButtonElement;
    backButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/home']);
  });
});

@Component({
  template: `
    <app-mobile-header title="Perfil">
      <button trailing aria-label="Configuració">Trailing</button>
    </app-mobile-header>
  `,
  imports: [MobileHeaderComponent],
})
class HostWithTrailingContentComponent {}

@Component({
  template: `<app-mobile-header title="Perfil" />`,
  imports: [MobileHeaderComponent],
})
class HostWithoutTrailingContentComponent {}

describe('MobileHeaderComponent trailing slot', () => {
  it('renders content projected into the trailing slot', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithTrailingContentComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithTrailingContentComponent);
    fixture.detectChanges();

    const trailing = fixture.nativeElement.querySelector('[aria-label="Configuració"]');
    expect(trailing).toBeTruthy();
    expect(trailing.textContent).toContain('Trailing');
  });

  it('renders nothing extra in the trailing slot when no content is projected', async () => {
    await TestBed.configureTestingModule({
      imports: [HostWithoutTrailingContentComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(HostWithoutTrailingContentComponent);
    fixture.detectChanges();

    const header = fixture.nativeElement.querySelector('header') as HTMLElement;
    expect(header.children.length).toBe(1); // just the <h1>, no back button, nothing trailing
  });
});
