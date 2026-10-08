import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemePickerComponent } from './theme-picker.component';
import { ThemePreference, ThemeService } from '../../services/theme.service';

describe('ThemePickerComponent', () => {
  let fixture: ComponentFixture<ThemePickerComponent>;
  const preference = signal<ThemePreference>('system');
  const setPreference = jest.fn((next: ThemePreference) => preference.set(next));

  const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));
  const pressed = () => buttons().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('aria-label'));

  beforeEach(() => {
    preference.set('system');
    setPreference.mockClear();
    TestBed.configureTestingModule({
      imports: [ThemePickerComponent],
      providers: [{ provide: ThemeService, useValue: { preference, setPreference } }],
    });
    fixture = TestBed.createComponent(ThemePickerComponent);
    fixture.detectChanges();
  });

  it('offers system, light and dark as compact icon buttons, named for screen readers and on hover', () => {
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['Sistema', 'Clar', 'Fosc']);
    expect(buttons().map((b) => b.getAttribute('title'))).toEqual(['Sistema', 'Clar', 'Fosc']);
    expect(buttons().every((b) => b.textContent?.trim() === '')).toBe(true);
    expect(buttons().every((b) => b.classList.contains('btn-xs') && b.classList.contains('btn-square'))).toBe(true);
  });

  it('labels the controls as one group', () => {
    expect(fixture.nativeElement.querySelector('[role="group"]').getAttribute('aria-label')).toBe('Aparença');
  });

  it('marks the current preference as pressed', () => {
    expect(pressed()).toEqual(['Sistema']);
  });

  it('applies the chosen preference', () => {
    buttons()[2].click();
    fixture.detectChanges();
    expect(setPreference).toHaveBeenCalledWith('dark');
    expect(pressed()).toEqual(['Fosc']);
  });
});
