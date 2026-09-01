import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CheckboxComponent } from './checkbox.component';

describe('CheckboxComponent', () => {
  let fixture: ComponentFixture<CheckboxComponent>;

  const nativeInput = () => fixture.debugElement.query(By.css('[data-testid="lib-checkbox-native"]')).nativeElement as HTMLInputElement;
  const labelEl = () => fixture.debugElement.query(By.css('label')).nativeElement as HTMLLabelElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CheckboxComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckboxComponent);
    fixture.detectChanges();
  });

  it('renders a native checkbox input', () => {
    expect(nativeInput().tagName).toBe('INPUT');
    expect(nativeInput().type).toBe('checkbox');
  });

  it('is unchecked by default', () => {
    expect(nativeInput().checked).toBe(false);
  });

  it('has no aria-label by default', () => {
    expect(nativeInput().hasAttribute('aria-label')).toBe(false);
  });

  it('sets aria-label on the native input, for a label-less checkbox', () => {
    fixture.componentRef.setInput('ariaLabel', 'Activar notificacions');
    fixture.detectChanges();
    expect(nativeInput().getAttribute('aria-label')).toBe('Activar notificacions');
  });

  describe('label linkage', () => {
    it("wires the label's for attribute to the native input's id", () => {
      const forAttr = labelEl().getAttribute('for');
      expect(forAttr).toBeTruthy();
      expect(nativeInput().id).toBe(forAttr);
    });

    it('auto-generates a distinct id per instance when none is provided', () => {
      const other = TestBed.createComponent(CheckboxComponent);
      other.detectChanges();
      const otherInput = other.debugElement.query(By.css('[data-testid="lib-checkbox-native"]')).nativeElement;
      expect(nativeInput().id).not.toBe(otherInput.id);
    });

    it('uses a provided id instead of auto-generating one', () => {
      fixture.componentRef.setInput('id', 'custom-checkbox-id');
      fixture.detectChanges();
      expect(nativeInput().id).toBe('custom-checkbox-id');
    });
  });

  describe('size', () => {
    it('defaults to the small size', () => {
      expect(nativeInput().className).toContain('checkbox-sm');
    });

    it('applies the requested size class', () => {
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();
      expect(nativeInput().className).toContain('checkbox-lg');
    });
  });

  describe('variant', () => {
    it('defaults to primary', () => {
      expect(nativeInput().className).toContain('checkbox-primary');
    });

    it('applies no color modifier class for "neutral"', () => {
      fixture.componentRef.setInput('variant', 'neutral');
      fixture.detectChanges();
      expect(nativeInput().className).not.toMatch(/checkbox-(primary|secondary|accent|success|warning|info|error)/);
    });

    it.each(['primary', 'secondary', 'accent', 'success', 'warning', 'info', 'error'] as const)(
      'applies checkbox-%s for that variant',
      (variant) => {
        fixture.componentRef.setInput('variant', variant);
        fixture.detectChanges();
        expect(nativeInput().className).toContain(`checkbox-${variant}`);
      },
    );
  });

  describe('disabled', () => {
    it('is not disabled by default', () => {
      expect(nativeInput().disabled).toBe(false);
    });

    it('disables the native input when the disabled input is set', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(nativeInput().disabled).toBe(true);
    });

    it('disables the native input via ControlValueAccessor.setDisabledState', () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      expect(nativeInput().disabled).toBe(true);
    });
  });

  it('forwards the required input to the native input', () => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    expect(nativeInput().required).toBe(true);
  });

  describe('content projection', () => {
    @Component({
      imports: [CheckboxComponent],
      template: `<lib-checkbox>Sols actius</lib-checkbox>`,
    })
    class HostComponent {}

    it('projects label content next to the input', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();

      expect(hostFixture.nativeElement.textContent).toContain('Sols actius');
    });
  });

  describe('ControlValueAccessor', () => {
    it('writeValue(true) checks the native input', () => {
      fixture.componentInstance.writeValue(true);
      fixture.detectChanges();
      expect(nativeInput().checked).toBe(true);
    });

    it('writeValue(null) leaves the native input unchecked', () => {
      fixture.componentInstance.writeValue(true);
      fixture.detectChanges();
      fixture.componentInstance.writeValue(null);
      fixture.detectChanges();
      expect(nativeInput().checked).toBe(false);
    });

    it('calls the registered onChange callback with the new checked state', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnChange(spy);

      nativeInput().checked = true;
      nativeInput().dispatchEvent(new Event('change'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith(true);
    });

    it('calls the registered onTouched callback on blur', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnTouched(spy);

      nativeInput().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with template-driven forms', () => {
    @Component({
      imports: [CheckboxComponent, FormsModule],
      template: `<lib-checkbox [(ngModel)]="value">Accepta</lib-checkbox>`,
    })
    class HostComponent {
      value = false;
    }

    it('supports two-way [(ngModel)] binding', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();

      const input = hostFixture.debugElement.query(By.css('[data-testid="lib-checkbox-native"]')).nativeElement as HTMLInputElement;
      input.checked = true;
      input.dispatchEvent(new Event('change'));
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      expect(hostFixture.componentInstance.value).toBe(true);
    });
  });

  describe('integration with reactive forms', () => {
    @Component({
      imports: [CheckboxComponent, ReactiveFormsModule],
      template: `<lib-checkbox [formControl]="control">Accepta</lib-checkbox>`,
    })
    class ReactiveHostComponent {
      readonly control = new FormControl(true);
    }

    it('reflects the initial reactive-form value', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [ReactiveHostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(ReactiveHostComponent);
      hostFixture.detectChanges();

      const input = hostFixture.debugElement.query(By.css('[data-testid="lib-checkbox-native"]')).nativeElement as HTMLInputElement;
      expect(input.checked).toBe(true);
    });
  });
});
