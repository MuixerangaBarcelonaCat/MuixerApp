import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from './select.component';

describe('SelectComponent', () => {
  let fixture: ComponentFixture<SelectComponent>;

  const labelEl = () => fixture.debugElement.query(By.css('label'));
  const nativeSelect = () => fixture.debugElement.query(By.css('[data-testid="lib-select-native"]')).nativeElement;
  const errorEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-error"]'));
  const hintEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-hint"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(SelectComponent);
    fixture.detectChanges();
  });

  it('renders a native select', () => {
    expect(nativeSelect().tagName).toBe('SELECT');
  });

  it('gives the native select its own >=24px tap target height (WI-03 parity)', () => {
    expect(nativeSelect().className).toContain('min-h-6');
  });

  it('has no aria-label by default', () => {
    expect(nativeSelect().hasAttribute('aria-label')).toBe(false);
  });

  it('sets aria-label on the real native select, for compact label-less usage', () => {
    fixture.componentRef.setInput('ariaLabel', 'Mode de la figura');
    fixture.detectChanges();
    expect(nativeSelect().getAttribute('aria-label')).toBe('Mode de la figura');
  });

  describe('label and id linkage', () => {
    it('renders the label text when label is set', () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('Disponibilitat');
    });

    it("wires the label's for attribute to the native select's id", () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.detectChanges();
      const forAttr = labelEl().nativeElement.getAttribute('for');
      expect(forAttr).toBeTruthy();
      expect(nativeSelect().id).toBe(forAttr);
    });

    it('auto-generates a distinct id per instance when none is provided', () => {
      const other = TestBed.createComponent(SelectComponent);
      other.detectChanges();
      const otherSelect = other.debugElement.query(By.css('[data-testid="lib-select-native"]')).nativeElement;
      expect(nativeSelect().id).not.toBe(otherSelect.id);
    });

    it('uses a provided id instead of auto-generating one', () => {
      fixture.componentRef.setInput('id', 'custom-select-id');
      fixture.detectChanges();
      expect(nativeSelect().id).toBe('custom-select-id');
    });
  });

  describe('size', () => {
    it('defaults to the small size', () => {
      const box = fixture.debugElement.query(By.css('.select'));
      expect(box.nativeElement.classList).toContain('select-sm');
    });

    it('applies the select-xs class for the "xs" size', () => {
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.select'));
      expect(box.nativeElement.classList).toContain('select-xs');
    });

    it('applies no size modifier class for the "md" size (DaisyUI default)', () => {
      fixture.componentRef.setInput('size', 'md');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.select'));
      expect(box.nativeElement.classList).not.toContain('select-sm');
      expect(box.nativeElement.classList).not.toContain('select-md');
    });
  });

  describe('hint and error — one slot, error wins', () => {
    it('shows the hint text when hint is set', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      expect(hintEl().nativeElement.textContent).toContain('Opcional.');
      expect(errorEl()).toBeNull();
    });

    it('shows the error text instead of the hint when both are set, and marks the select invalid', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.componentRef.setInput('errorText', 'Camp obligatori.');
      fixture.detectChanges();
      expect(errorEl().nativeElement.textContent).toContain('Camp obligatori.');
      expect(hintEl()).toBeNull();
      expect(nativeSelect().getAttribute('aria-invalid')).toBe('true');
    });

    it('applies the select-error class to the select box when errorText is set', () => {
      fixture.componentRef.setInput('errorText', 'Camp obligatori.');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.select'));
      expect(box.nativeElement.classList).toContain('select-error');
    });

    it('links the hint/error text via aria-describedby on the native select', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      const describedBy = nativeSelect().getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(hintEl().nativeElement.id).toBe(describedBy);
    });
  });

  describe('swatch — a leading color dot reliably shown in the closed control, independent of', () => {
    // browser support for appearance: base-select (which only renders rich <option> content in
    // supported browsers — Firefox/Safari fall back to plain text, dropping any swatch projected
    // as option content instead of using this input).
    const swatchEl = () => fixture.debugElement.query(By.css('[data-testid="lib-select-swatch"]'));

    it('renders no swatch by default', () => {
      expect(swatchEl()).toBeNull();
    });

    it('renders a colored circle swatch when swatchColor is set', () => {
      fixture.componentRef.setInput('swatchColor', '#0d9488');
      fixture.detectChanges();
      expect(swatchEl()).toBeTruthy();
      expect(swatchEl().nativeElement.style.backgroundColor).toBeTruthy();
      expect(swatchEl().nativeElement.classList).toContain('rounded-full');
    });

    it('renders a square swatch when swatchShape is "square"', () => {
      fixture.componentRef.setInput('swatchColor', '#0d9488');
      fixture.componentRef.setInput('swatchShape', 'square');
      fixture.detectChanges();
      expect(swatchEl().nativeElement.classList).not.toContain('rounded-full');
    });

    it('adds left padding to the select box to make room for the swatch', () => {
      fixture.componentRef.setInput('swatchColor', '#0d9488');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.select'));
      expect(box.nativeElement.classList).toContain('pl-6');
    });
  });

  describe('disabled', () => {
    it('is not disabled by default', () => {
      expect(nativeSelect().disabled).toBe(false);
    });

    it('disables the native select when the disabled input is set', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(nativeSelect().disabled).toBe(true);
    });

    it('disables the native select via ControlValueAccessor.setDisabledState', () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      expect(nativeSelect().disabled).toBe(true);
    });
  });

  describe('ControlValueAccessor and projected options', () => {
    @Component({
      imports: [SelectComponent, FormsModule],
      template: `
        <lib-select [(ngModel)]="value" label="Disponibilitat">
          <option value="AVAILABLE">Disponible</option>
          <option value="UNAVAILABLE">No disponible</option>
        </lib-select>
      `,
    })
    class HostComponent {
      value = 'UNAVAILABLE';
    }

    it('projects the caller-supplied <option> elements into the native select', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();

      const options = hostFixture.debugElement.queryAll(By.css('option'));
      expect(options.length).toBe(2);
      expect(options.map((o) => o.nativeElement.value)).toEqual(['AVAILABLE', 'UNAVAILABLE']);
    });

    it('supports two-way [(ngModel)] binding, reflecting the initial value', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();
      // The select's own `effect()` (see select.component.ts) applies `.value` asynchronously,
      // after the projected <option>s have settled — whenStable() flushes it, and a second
      // detectChanges() picks up the resulting DOM write within Angular's own signal cycle.
      await hostFixture.whenStable();
      hostFixture.detectChanges();

      const select = hostFixture.debugElement.query(By.css('[data-testid="lib-select-native"]')).nativeElement as HTMLSelectElement;
      expect(select.value).toBe('UNAVAILABLE');

      select.value = 'AVAILABLE';
      select.dispatchEvent(new Event('change'));
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      expect(hostFixture.componentInstance.value).toBe('AVAILABLE');
    });
  });

  describe('reactive form with a pre-set value', () => {
    @Component({
      imports: [SelectComponent, ReactiveFormsModule],
      template: `
        <lib-select [formControl]="control" label="Grup">
          @for (group of groups; track group) {
            <option [value]="group">{{ group }}</option>
          }
        </lib-select>
      `,
    })
    class ReactiveHostComponent {
      readonly groups = ['PINYA', 'TRONC', 'ALTRES'];
      readonly control = new FormControl('TRONC');
    }

    // A reactive control writes its value synchronously, while the projected <option>s are only
    // inserted once the caller's view renders. Assigning a value the <select> has no option for
    // silently leaves it blank, so the value has to be re-applied once the options exist.
    it('shows the value even though the control was set before the options rendered', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [ReactiveHostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(ReactiveHostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();
      hostFixture.detectChanges();

      const select = hostFixture.debugElement.query(By.css('[data-testid="lib-select-native"]'))
        .nativeElement as HTMLSelectElement;
      expect(select.value).toBe('TRONC');
    });

    it('keeps the value the user picked when the option list changes afterwards', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [ReactiveHostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(ReactiveHostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      const select = hostFixture.debugElement.query(By.css('[data-testid="lib-select-native"]'))
        .nativeElement as HTMLSelectElement;
      select.value = 'PINYA';
      select.dispatchEvent(new Event('change'));
      hostFixture.detectChanges();
      await hostFixture.whenStable();
      hostFixture.detectChanges();

      expect(select.value).toBe('PINYA');
      expect(hostFixture.componentInstance.control.value).toBe('PINYA');
    });
  });

  describe('multiple mode', () => {
    @Component({
      imports: [SelectComponent, FormsModule],
      template: `
        <lib-select [(ngModel)]="value" [multiple]="true" label="Etiquetes">
          <option value="vent">Vent</option>
          <option value="baix">
            <span class="swatch" data-testid="swatch"></span>
            Baix
          </option>
        </lib-select>
      `,
    })
    class MultiHostComponent {
      value: string[] = ['baix'];
    }

    let hostFixture: ComponentFixture<MultiHostComponent>;

    beforeEach(async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [MultiHostComponent] }).compileComponents();
      hostFixture = TestBed.createComponent(MultiHostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();
      hostFixture.detectChanges();
    });

    const trigger = () => hostFixture.debugElement.query(By.css('[data-testid="lib-select-multi-trigger"]')).nativeElement as HTMLElement;
    const checkboxes = () => hostFixture.debugElement.queryAll(By.css('[data-testid="lib-select-multi"] input[type="checkbox"]'));

    it('hides the native select and renders a checkbox dropdown instead', () => {
      const nativeSelect = hostFixture.debugElement.query(By.css('[data-testid="lib-select-native"]')).nativeElement as HTMLElement;
      expect(nativeSelect.classList).toContain('hidden');
      expect(hostFixture.debugElement.query(By.css('[data-testid="lib-select-multi"]'))).toBeTruthy();
    });

    it('renders one checkbox row per projected option, reflecting the initial value', () => {
      const boxes = checkboxes();
      expect(boxes.length).toBe(2);
      expect((boxes[0].nativeElement as HTMLInputElement).checked).toBe(false);
      expect((boxes[1].nativeElement as HTMLInputElement).checked).toBe(true);
    });

    it('shows a count summary once options are selected', () => {
      expect(trigger().textContent).toContain('1 seleccionades');
    });

    it('shows the placeholder when nothing is selected', () => {
      // Deselect via a real interaction (not a direct property write) — [(ngModel)] already owns
      // this property, and writing it out-of-band trips Angular's checkNoChanges in dev mode.
      (checkboxes()[1].nativeElement as HTMLInputElement).click();
      hostFixture.detectChanges();
      expect(trigger().textContent).toContain('Totes');
    });

    it('toggling a checkbox updates the bound array via ngModel', () => {
      const boxes = checkboxes();
      (boxes[0].nativeElement as HTMLInputElement).click();
      hostFixture.detectChanges();
      expect(hostFixture.componentInstance.value).toEqual(['baix', 'vent']);
    });

    it('clones rich <option> content (not just text) into the checkbox row', () => {
      const swatch = hostFixture.debugElement.query(By.css('[data-testid="lib-select-multi"] .swatch'));
      expect(swatch).toBeTruthy();
      // A clone, not the original node reused — the source <option> still has its own.
      expect(hostFixture.debugElement.query(By.css('option[value="baix"] .swatch'))).toBeTruthy();
    });
  });
});
