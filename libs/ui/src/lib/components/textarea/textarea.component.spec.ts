import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TextareaComponent } from './textarea.component';

describe('TextareaComponent', () => {
  let fixture: ComponentFixture<TextareaComponent>;

  const labelEl = () => fixture.debugElement.query(By.css('label'));
  const nativeTextarea = () =>
    fixture.debugElement.query(By.css('[data-testid="lib-textarea-native"]')).nativeElement as HTMLTextAreaElement;
  const errorEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-error"]'));
  const hintEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-hint"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextareaComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TextareaComponent);
    fixture.detectChanges();
  });

  it('renders a native textarea', () => {
    expect(nativeTextarea().tagName).toBe('TEXTAREA');
  });

  it('has no aria-label by default', () => {
    expect(nativeTextarea().hasAttribute('aria-label')).toBe(false);
  });

  it('sets aria-label on the native textarea, for compact label-less usage', () => {
    fixture.componentRef.setInput('ariaLabel', 'Notes');
    fixture.detectChanges();
    expect(nativeTextarea().getAttribute('aria-label')).toBe('Notes');
  });

  it('forwards the placeholder input to the native textarea', () => {
    fixture.componentRef.setInput('placeholder', 'Escriu una descripció...');
    fixture.detectChanges();
    expect(nativeTextarea().placeholder).toBe('Escriu una descripció...');
  });

  describe('rows', () => {
    it('defaults to 3 rows', () => {
      expect(nativeTextarea().rows).toBe(3);
    });

    it('forwards a custom rows count', () => {
      fixture.componentRef.setInput('rows', 6);
      fixture.detectChanges();
      expect(nativeTextarea().rows).toBe(6);
    });
  });

  describe('resize', () => {
    it('allows resizing by default', () => {
      expect(nativeTextarea().className).not.toContain('resize-none');
    });

    it('disables resizing when resize is false', () => {
      fixture.componentRef.setInput('resize', false);
      fixture.detectChanges();
      expect(nativeTextarea().className).toContain('resize-none');
    });
  });

  describe('maxLength', () => {
    it('sets no maxlength attribute by default', () => {
      expect(nativeTextarea().hasAttribute('maxlength')).toBe(false);
    });

    it('forwards maxLength to the native textarea', () => {
      fixture.componentRef.setInput('maxLength', 500);
      fixture.detectChanges();
      expect(nativeTextarea().maxLength).toBe(500);
    });
  });

  describe('label and id linkage', () => {
    it('renders no label element when label is not set', () => {
      expect(labelEl()).toBeNull();
    });

    it('renders the label text when label is set', () => {
      fixture.componentRef.setInput('label', 'Descripció');
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('Descripció');
    });

    it("wires the label's for attribute to the native textarea's id", () => {
      fixture.componentRef.setInput('label', 'Descripció');
      fixture.detectChanges();
      const forAttr = labelEl().nativeElement.getAttribute('for');
      expect(forAttr).toBeTruthy();
      expect(nativeTextarea().id).toBe(forAttr);
    });

    it('auto-generates a distinct id per instance when none is provided', () => {
      const other = TestBed.createComponent(TextareaComponent);
      other.detectChanges();
      const otherTextarea = other.debugElement.query(By.css('[data-testid="lib-textarea-native"]')).nativeElement;
      expect(nativeTextarea().id).not.toBe(otherTextarea.id);
    });

    it('uses a provided id instead of auto-generating one', () => {
      fixture.componentRef.setInput('id', 'custom-textarea-id');
      fixture.detectChanges();
      expect(nativeTextarea().id).toBe('custom-textarea-id');
    });

    it('appends a required marker to the label text when required is set', () => {
      fixture.componentRef.setInput('label', 'Descripció');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('*');
    });
  });

  describe('hint and error — one slot, error wins', () => {
    it('shows nothing below the textarea by default', () => {
      expect(errorEl()).toBeNull();
      expect(hintEl()).toBeNull();
    });

    it('shows the hint text when hint is set', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      expect(hintEl().nativeElement.textContent).toContain('Opcional.');
      expect(errorEl()).toBeNull();
    });

    it('shows the error text instead of the hint when both are set, and marks the textarea invalid', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.componentRef.setInput('errorText', 'Massa llarg.');
      fixture.detectChanges();
      expect(errorEl().nativeElement.textContent).toContain('Massa llarg.');
      expect(hintEl()).toBeNull();
      expect(nativeTextarea().getAttribute('aria-invalid')).toBe('true');
    });

    it('applies the textarea-error class when errorText is set', () => {
      fixture.componentRef.setInput('errorText', 'Massa llarg.');
      fixture.detectChanges();
      expect(nativeTextarea().className).toContain('textarea-error');
    });

    it('links the hint/error text via aria-describedby on the native textarea', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      const describedBy = nativeTextarea().getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(hintEl().nativeElement.id).toBe(describedBy);
    });
  });

  describe('size', () => {
    it('defaults to the small size', () => {
      expect(nativeTextarea().className).toContain('textarea-sm');
    });

    it('applies no size modifier class for the "md" size (DaisyUI default)', () => {
      fixture.componentRef.setInput('size', 'md');
      fixture.detectChanges();
      expect(nativeTextarea().className).not.toContain('textarea-sm');
      expect(nativeTextarea().className).not.toContain('textarea-md');
    });

    it('applies the textarea-xs class for the "xs" size', () => {
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      expect(nativeTextarea().className).toContain('textarea-xs');
    });
  });

  describe('disabled', () => {
    it('is not disabled by default', () => {
      expect(nativeTextarea().disabled).toBe(false);
    });

    it('disables the native textarea when the disabled input is set', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(nativeTextarea().disabled).toBe(true);
    });

    it('disables the native textarea via ControlValueAccessor.setDisabledState', () => {
      fixture.componentInstance.setDisabledState(true);
      fixture.detectChanges();
      expect(nativeTextarea().disabled).toBe(true);
    });
  });

  it('forwards the required input to the native textarea', () => {
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
    expect(nativeTextarea().required).toBe(true);
  });

  it('does not steal focus by default', () => {
    expect(document.activeElement).not.toBe(nativeTextarea());
  });

  it('focuses the native textarea when autofocus is set', () => {
    const other = TestBed.createComponent(TextareaComponent);
    other.componentRef.setInput('autofocus', true);
    other.detectChanges();
    const otherTextarea = other.debugElement.query(By.css('[data-testid="lib-textarea-native"]')).nativeElement;
    expect(document.activeElement).toBe(otherTextarea);
  });

  it('emits (blurred) when the native textarea blurs, for callers that commit a live-preview value on blur', () => {
    const spy = jest.fn();
    fixture.componentInstance.blurred.subscribe(spy);

    nativeTextarea().dispatchEvent(new Event('blur'));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  describe('ControlValueAccessor', () => {
    it('writeValue sets the native textarea value', () => {
      fixture.componentInstance.writeValue('hola');
      fixture.detectChanges();
      expect(nativeTextarea().value).toBe('hola');
    });

    it('writeValue(null) clears the native textarea value', () => {
      fixture.componentInstance.writeValue('hola');
      fixture.detectChanges();
      fixture.componentInstance.writeValue(null);
      fixture.detectChanges();
      expect(nativeTextarea().value).toBe('');
    });

    it('calls the registered onChange callback with the new value when the user types', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnChange(spy);

      const el = nativeTextarea();
      el.value = 'typed value';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith('typed value');
    });

    it('calls the registered onTouched callback on blur', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnTouched(spy);

      nativeTextarea().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with template-driven forms', () => {
    @Component({
      imports: [TextareaComponent, FormsModule],
      template: `<lib-textarea [(ngModel)]="value" label="Notes" />`,
    })
    class HostComponent {
      value = '';
    }

    it('supports two-way [(ngModel)] binding', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      const el = hostFixture.debugElement.query(By.css('[data-testid="lib-textarea-native"]')).nativeElement;
      el.value = 'ngmodel value';
      el.dispatchEvent(new Event('input'));
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      expect(hostFixture.componentInstance.value).toBe('ngmodel value');
    });
  });

  describe('integration with reactive forms', () => {
    @Component({
      imports: [TextareaComponent, ReactiveFormsModule],
      template: `<lib-textarea [formControl]="control" label="Notes" />`,
    })
    class ReactiveHostComponent {
      readonly control = new FormControl('valor inicial');
    }

    it('reflects the initial reactive-form value', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [ReactiveHostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(ReactiveHostComponent);
      hostFixture.detectChanges();

      const el = hostFixture.debugElement.query(By.css('[data-testid="lib-textarea-native"]')).nativeElement;
      expect(el.value).toBe('valor inicial');
    });
  });
});
