import { ComponentFixture, TestBed } from '@angular/core/testing';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { ColorPickerComponent } from './color-picker.component';

describe('ColorPickerComponent', () => {
  let fixture: ComponentFixture<ColorPickerComponent>;
  let component: ColorPickerComponent;
  let el: HTMLElement;

  const PRESET_COLORS = ['#ff0000', '#00ff00', '#0000ff'];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ColorPickerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(ColorPickerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('color', '#ff0000');
    fixture.componentRef.setInput('presetColors', PRESET_COLORS);
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  describe('swatch trigger', () => {
    it('renders with the current color as background', () => {
      const swatch = el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]');
      expect(swatch).toBeTruthy();
      expect(swatch!.style.backgroundColor).toBeTruthy();
    });

    it('opens the popover on click', () => {
      el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!.click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="color-picker-popover"]')).toBeTruthy();
    });

    it('closes the popover on second click', () => {
      const swatch = el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!;
      swatch.click();
      fixture.detectChanges();
      swatch.click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="color-picker-popover"]')).toBeNull();
    });

    it('has aria-expanded attribute', () => {
      const swatch = el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!;
      expect(swatch.getAttribute('aria-expanded')).toBe('false');
      swatch.click();
      fixture.detectChanges();
      expect(swatch.getAttribute('aria-expanded')).toBe('true');
    });
  });

  describe('preset swatches', () => {
    beforeEach(() => {
      el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!.click();
      fixture.detectChanges();
    });

    it('renders the correct number of preset swatches', () => {
      const swatches = el.querySelectorAll('[data-testid="color-picker-preset"]');
      expect(swatches.length).toBe(PRESET_COLORS.length);
    });

    it('emits colorChange and closes popover when a swatch is clicked', () => {
      const emitted: string[] = [];
      component.colorChange.subscribe((c) => emitted.push(c));

      const swatch = el.querySelector<HTMLElement>('[data-testid="color-picker-preset"]')!;
      swatch.click();
      fixture.detectChanges();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe(PRESET_COLORS[0]);
      expect(el.querySelector('[data-testid="color-picker-popover"]')).toBeNull();
    });

    it('marks the current color as selected (aria-selected)', () => {
      const swatches = el.querySelectorAll('[data-testid="color-picker-preset"]');
      const selected = Array.from(swatches).find(
        (s) => s.getAttribute('aria-selected') === 'true',
      );
      expect(selected).toBeTruthy();
    });
  });

  describe('hex input', () => {
    beforeEach(() => {
      el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!.click();
      fixture.detectChanges();
    });

    it('renders the hex input field', () => {
      expect(el.querySelector('[data-testid="color-picker-hex-input"]')).toBeTruthy();
    });

    it('emits colorChange on blur with a valid hex value', () => {
      const emitted: string[] = [];
      component.colorChange.subscribe((c) => emitted.push(c));

      component.onHexInput('#AABBCC');
      fixture.detectChanges();
      component.onHexBlur();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe('#AABBCC');
    });

    it('does not emit on blur with an invalid hex value', () => {
      const emitted: string[] = [];
      component.colorChange.subscribe((c) => emitted.push(c));

      component.onHexInput('notacolor');
      fixture.detectChanges();
      component.onHexBlur();

      expect(emitted.length).toBe(0);
    });

    it('emits colorChange on blur when hex is typed without #', () => {
      const emitted: string[] = [];
      component.colorChange.subscribe((c) => emitted.push(c));

      component.onHexInput('AABBCC');
      fixture.detectChanges();
      component.onHexBlur();

      expect(emitted.length).toBe(1);
      expect(emitted[0]).toBe('#AABBCC');
    });

    it('does not emit on blur when hex is empty', () => {
      const emitted: string[] = [];
      component.colorChange.subscribe((c) => emitted.push(c));

      component.onHexInput('');
      component.onHexBlur();

      expect(emitted.length).toBe(0);
    });
  });

  describe('keyboard accessibility', () => {
    it('closes the popover on Escape key', () => {
      el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!.click();
      fixture.detectChanges();
      expect(el.querySelector('[data-testid="color-picker-popover"]')).toBeTruthy();

      component.onEscape();
      fixture.detectChanges();

      expect(el.querySelector('[data-testid="color-picker-popover"]')).toBeNull();
    });

    it('does not error if Escape is pressed when popover is already closed', () => {
      expect(() => component.onEscape()).not.toThrow();
    });
  });

  describe('isValidHex computed', () => {
    it('returns true for valid 6-digit hex', () => {
      component.hexInput.set('#AABBCC');
      expect(component.isValidHex()).toBe(true);
    });

    it('returns false for 3-digit hex', () => {
      component.hexInput.set('#ABC');
      expect(component.isValidHex()).toBe(false);
    });

    it('returns true for hex without hash (auto-normalized)', () => {
      component.hexInput.set('AABBCC');
      expect(component.isValidHex()).toBe(true);
    });

    it('returns false for empty string', () => {
      component.hexInput.set('');
      expect(component.isValidHex()).toBe(false);
    });
  });

  describe('no preset colors', () => {
    it('does not render preset grid when presetColors is empty', () => {
      fixture.componentRef.setInput('presetColors', []);
      fixture.detectChanges();
      el.querySelector<HTMLElement>('[data-testid="color-picker-swatch"]')!.click();
      fixture.detectChanges();
      expect(el.querySelectorAll('[data-testid="color-picker-preset"]').length).toBe(0);
    });
  });
});
