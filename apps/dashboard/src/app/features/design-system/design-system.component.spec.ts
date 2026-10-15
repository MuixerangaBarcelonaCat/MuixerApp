import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { describe, it, expect, beforeEach } from 'vitest';
import { ThemeMode, ThemePreference, ThemeService } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { DesignSystemComponent } from './design-system.component';
import { ColorSectionComponent } from './sections/color-section.component';

describe('DesignSystemComponent', () => {
  let fixture: ComponentFixture<DesignSystemComponent>;
  const mode = signal<ThemeMode>('light');
  const preference = signal<ThemePreference>('system');

  beforeEach(async () => {
    mode.set('light');
    await TestBed.configureTestingModule({
      imports: [DesignSystemComponent],
      providers: [
        allLucideIconsProvider,
        { provide: ThemeService, useValue: { mode, preference, setPreference: (p: ThemePreference) => preference.set(p) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DesignSystemComponent);
    fixture.detectChanges();
  });

  const colorSection = () =>
    fixture.debugElement.query((el) => el.componentInstance instanceof ColorSectionComponent).componentInstance as ColorSectionComponent;

  it('shows the shared theme picker in the header', () => {
    expect(fixture.nativeElement.querySelector('app-page-header lib-theme-picker')).not.toBeNull();
  });

  it('renders the color swatches for the mode actually on screen', () => {
    expect(colorSection().mode()).toBe('light');
    mode.set('dark');
    fixture.detectChanges();
    expect(colorSection().mode()).toBe('dark');
  });
});
