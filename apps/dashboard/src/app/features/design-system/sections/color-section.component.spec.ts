import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ATTENDANCE_TONES, ATTENDANCE_TONES_DARK, GENDER_TONES, GENDER_TONES_DARK, heightRampTones } from '@muixer/ui';
import { ColorSectionComponent } from './color-section.component';

describe('ColorSectionComponent', () => {
  let fixture: ComponentFixture<ColorSectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ColorSectionComponent] }).compileComponents();
    fixture = TestBed.createComponent(ColorSectionComponent);
    fixture.componentRef.setInput('mode', 'light');
    fixture.detectChanges();
  });

  /** Every wash/pencil pair of the display-mode block, as `wash|pencil`. */
  const displayModeSwatches = () =>
    Array.from(fixture.nativeElement.querySelectorAll('[data-testid="display-mode-swatch"]') as NodeListOf<HTMLElement>).map(
      (el) => `${el.dataset['wash']}|${el.dataset['pencil']}`,
    );

  it('shows every display-mode tone: gender, attendance (both shades) and the height ramp', () => {
    const swatches = displayModeSwatches();
    expect(swatches).toContain(`${GENDER_TONES.female.wash}|${GENDER_TONES.female.pencil}`);
    expect(swatches).toContain(`${ATTENDANCE_TONES.warning.strong.wash}|${ATTENDANCE_TONES.warning.strong.pencil}`);
    expect(swatches).toContain(`${heightRampTones(1).wash}|${heightRampTones(1).pencil}`);
    expect(swatches).toHaveLength(3 + 6 + 5);
  });

  it('shows the dark tones in dark mode', () => {
    fixture.componentRef.setInput('mode', 'dark');
    fixture.detectChanges();
    const swatches = displayModeSwatches();
    expect(swatches).toContain(`${GENDER_TONES_DARK.male.wash}|${GENDER_TONES_DARK.male.pencil}`);
    expect(swatches).toContain(`${ATTENDANCE_TONES_DARK.error.base.wash}|${ATTENDANCE_TONES_DARK.error.base.pencil}`);
    expect(swatches).toContain(`${heightRampTones(0, 'dark').wash}|${heightRampTones(0, 'dark').pencil}`);
  });
});
