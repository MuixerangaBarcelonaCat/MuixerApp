import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { User } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { InputComponent } from './input.component';

describe('InputComponent', () => {
  let fixture: ComponentFixture<InputComponent>;

  const labelEl = () => fixture.debugElement.query(By.css('label'));
  const nativeInput = () => fixture.debugElement.query(By.css('[data-testid="lib-input-native"]')).nativeElement;
  const iconEl = () => fixture.debugElement.query(By.css('[data-testid="lib-input-icon"]'));
  // Rendered by lib-form-field now, which lib-input's own template delegates its label/hint/
  // error chrome to — not lib-input's own markup, hence the different testid prefix.
  const errorEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-error"]'));
  const hintEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-hint"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InputComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(InputComponent);
    fixture.detectChanges();
  });

  it('renders a native text input by default', () => {
    expect(nativeInput().tagName).toBe('INPUT');
    expect(nativeInput().type).toBe('text');
  });

  it('has no aria-label by default', () => {
    expect(nativeInput().hasAttribute('aria-label')).toBe(false);
  });

  it('does not steal focus by default', () => {
    expect(document.activeElement).not.toBe(nativeInput());
  });

  it('focuses the native input when autofocus is set', () => {
    const other = TestBed.createComponent(InputComponent);
    other.componentRef.setInput('autofocus', true);
    other.detectChanges();
    const otherInput = other.debugElement.query(By.css('[data-testid="lib-input-native"]')).nativeElement;
    expect(document.activeElement).toBe(otherInput);
  });

  it('sets aria-label on the real native input, for compact label-less usage', () => {
    fixture.componentRef.setInput('ariaLabel', 'Nom del segment');
    fixture.detectChanges();
    expect(nativeInput().getAttribute('aria-label')).toBe('Nom del segment');
  });

  it('forwards the type input to the native input', () => {
    fixture.componentRef.setInput('type', 'email');
    fixture.detectChanges();
    expect(nativeInput().type).toBe('email');
  });

  it('supports the date type, for detail-view edit forms (birth date, shirt date, ...)', () => {
    fixture.componentRef.setInput('type', 'date');
    fixture.detectChanges();
    expect(nativeInput().type).toBe('date');
  });

  describe('name — perquè els gestors de contrasenyes reconeguen el camp', () => {
    it('sets no name attribute by default', () => {
      expect(nativeInput().hasAttribute('name')).toBe(false);
    });

    it('forwards name to the native input', () => {
      fixture.componentRef.setInput('name', 'password');
      fixture.detectChanges();
      expect(nativeInput().getAttribute('name')).toBe('password');
    });
  });

  describe('readonly — camp visible i enviable, però no editable', () => {
    it('is not readonly by default', () => {
      expect(nativeInput().readOnly).toBe(false);
    });

    it('forwards readonly to the native input without disabling it', () => {
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
      // A diferència de `disabled`, un camp readonly s'envia amb el formulari i el gestor de
      // contrasenyes del navegador el veu — d'ací que l'email prellenat de l'activació l'use.
      expect(nativeInput().readOnly).toBe(true);
      expect(nativeInput().disabled).toBe(false);
    });

    it('hides the password reveal button while readonly, as there is nothing to type', () => {
      fixture.componentRef.setInput('type', 'password');
      fixture.componentRef.setInput('readonly', true);
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('[data-testid="lib-input-reveal"]'))).toBeNull();
    });
  });

  describe('maxLength', () => {
    it('sets no maxlength attribute by default', () => {
      expect(nativeInput().hasAttribute('maxlength')).toBe(false);
    });

    it('forwards maxLength to the native input', () => {
      fixture.componentRef.setInput('maxLength', 6);
      fixture.detectChanges();
      expect(nativeInput().maxLength).toBe(6);
    });
  });

  describe('min/max — numeric and date range constraints', () => {
    it('sets no min/max attribute by default', () => {
      expect(nativeInput().hasAttribute('min')).toBe(false);
      expect(nativeInput().hasAttribute('max')).toBe(false);
    });

    it('forwards min/max to the native input', () => {
      fixture.componentRef.setInput('type', 'number');
      fixture.componentRef.setInput('min', 0);
      fixture.componentRef.setInput('max', 250);
      fixture.detectChanges();
      expect(nativeInput().min).toBe('0');
      expect(nativeInput().max).toBe('250');
    });
  });

  it('forwards the placeholder input to the native input', () => {
    fixture.componentRef.setInput('placeholder', 'nom@exemple.com');
    fixture.detectChanges();
    expect(nativeInput().placeholder).toBe('nom@exemple.com');
  });

  it('gives the native input its own >=24px tap target height (WI-03 parity, not just the wrapper box)', () => {
    expect(nativeInput().className).toContain('min-h-6');
  });

  describe('label and id linkage', () => {
    it('renders no label element when label is not set', () => {
      expect(labelEl()).toBeNull();
    });

    it('renders the label text when label is set', () => {
      fixture.componentRef.setInput('label', 'Correu electrònic');
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('Correu electrònic');
    });

    it("wires the label's for attribute to the native input's id", () => {
      fixture.componentRef.setInput('label', 'Correu electrònic');
      fixture.detectChanges();
      const forAttr = labelEl().nativeElement.getAttribute('for');
      expect(forAttr).toBeTruthy();
      expect(nativeInput().id).toBe(forAttr);
    });

    it('auto-generates a distinct id per instance when none is provided', () => {
      const other = TestBed.createComponent(InputComponent);
      other.detectChanges();
      const otherInput = other.debugElement.query(By.css('[data-testid="lib-input-native"]')).nativeElement;
      expect(nativeInput().id).not.toBe(otherInput.id);
    });

    it('uses a provided id instead of auto-generating one', () => {
      fixture.componentRef.setInput('id', 'custom-email-id');
      fixture.detectChanges();
      expect(nativeInput().id).toBe('custom-email-id');
    });

    // A static `id="…"` written on <lib-input> is also reflected onto the host element by the
    // template compiler, which would leave two elements sharing the id — and an external
    // <label for="…"> pointing at the wrapper instead of the field.
    it('keeps the id off the host element, so it identifies the native input only', () => {
      fixture.componentRef.setInput('id', 'custom-email-id');
      fixture.detectChanges();
      expect(fixture.nativeElement.hasAttribute('id')).toBe(false);
    });

    it('appends a required marker to the label text when required is set', () => {
      fixture.componentRef.setInput('label', 'Correu electrònic');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('*');
    });
  });

  describe('hint and error — one slot, error wins', () => {
    it('shows nothing below the input by default', () => {
      expect(errorEl()).toBeNull();
      expect(hintEl()).toBeNull();
    });

    it('shows the hint text when hint is set', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      expect(hintEl().nativeElement.textContent).toContain('Opcional.');
      expect(errorEl()).toBeNull();
    });

    it('shows the error text instead of the hint when both are set, and marks the input invalid', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.componentRef.setInput('errorText', 'Format de correu invàlid.');
      fixture.detectChanges();
      expect(errorEl().nativeElement.textContent).toContain('Format de correu invàlid.');
      expect(hintEl()).toBeNull();
      expect(nativeInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('applies the input-error class to the input box when errorText is set', () => {
      fixture.componentRef.setInput('errorText', 'Format de correu invàlid.');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.input'));
      expect(box.nativeElement.classList).toContain('input-error');
    });

    it('links the hint/error text via aria-describedby on the native input', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      const describedBy = nativeInput().getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(hintEl().nativeElement.id).toBe(describedBy);
    });

    it('sets no aria-describedby when there is neither hint nor error', () => {
      expect(nativeInput().getAttribute('aria-describedby')).toBeNull();
    });
  });

  describe('password reveal toggle', () => {
    const toggleEl = () => fixture.debugElement.query(By.css('[data-testid="lib-input-reveal"]'));
    const setPasswordType = () => {
      fixture.componentRef.setInput('type', 'password');
      fixture.detectChanges();
    };

    it('renders no toggle for a non-password input', () => {
      expect(toggleEl()).toBeNull();
    });

    it('renders the toggle for a password input, hidden by default', () => {
      setPasswordType();
      expect(toggleEl()).toBeTruthy();
      expect(nativeInput().type).toBe('password');
      expect(toggleEl().nativeElement.getAttribute('aria-pressed')).toBe('false');
    });

    it('reveals the value on click and hides it again on a second click', () => {
      setPasswordType();

      toggleEl().nativeElement.click();
      fixture.detectChanges();
      expect(nativeInput().type).toBe('text');
      expect(toggleEl().nativeElement.getAttribute('aria-pressed')).toBe('true');

      toggleEl().nativeElement.click();
      fixture.detectChanges();
      expect(nativeInput().type).toBe('password');
      expect(toggleEl().nativeElement.getAttribute('aria-pressed')).toBe('false');
    });

    it('is a plain button so it never submits the surrounding form', () => {
      setPasswordType();
      expect(toggleEl().nativeElement.getAttribute('type')).toBe('button');
    });

    it('names the action for screen readers and flips the label once revealed', () => {
      setPasswordType();
      expect(toggleEl().nativeElement.getAttribute('aria-label')).toBe('Mostra la contrasenya');

      toggleEl().nativeElement.click();
      fixture.detectChanges();
      expect(toggleEl().nativeElement.getAttribute('aria-label')).toBe('Amaga la contrasenya');
    });

    it('is disabled together with the field', () => {
      setPasswordType();
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(toggleEl().nativeElement.disabled).toBe(true);
    });

    it('falls back to the masked type when the caller switches away from password while revealed', () => {
      setPasswordType();
      toggleEl().nativeElement.click();
      fixture.detectChanges();

      fixture.componentRef.setInput('type', 'email');
      fixture.detectChanges();

      expect(nativeInput().type).toBe('email');
      expect(toggleEl()).toBeNull();
    });
  });

  describe('icon', () => {
    it('renders no icon by default', () => {
      expect(iconEl()).toBeNull();
    });

    it('renders the icon when set', () => {
      fixture.componentRef.setInput('icon', User);
      fixture.detectChanges();
      expect(iconEl()).toBeTruthy();
    });
  });

  describe('size', () => {
    it('defaults to the small size, matching real usage across the app', () => {
      const box = fixture.debugElement.query(By.css('.input'));
      expect(box.nativeElement.classList).toContain('input-sm');
    });

    it('applies no size modifier class for the "md" size (DaisyUI default)', () => {
      fixture.componentRef.setInput('size', 'md');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.input'));
      expect(box.nativeElement.classList).not.toContain('input-sm');
      expect(box.nativeElement.classList).not.toContain('input-md');
    });

    it('applies the input-lg class for the "lg" size', () => {
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();
      const box = fixture.debugElement.query(By.css('.input'));
      expect(box.nativeElement.classList).toContain('input-lg');
    });

    it('shrinks the label text to match an xs input, so the label does not dwarf a compact field', () => {
      fixture.componentRef.setInput('label', 'Àlies');
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      const labelText = fixture.debugElement.query(By.css('.label-text'));
      expect(labelText.nativeElement.className).toContain('text-xs');
    });

    it('leaves the label text at its default size for sm/md/lg', () => {
      fixture.componentRef.setInput('label', 'Àlies');
      fixture.detectChanges();
      const labelText = fixture.debugElement.query(By.css('.label-text'));
      expect(labelText.nativeElement.className).not.toContain('text-xs');
    });
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

  describe('ControlValueAccessor', () => {
    it('writeValue sets the native input value', () => {
      fixture.componentInstance.writeValue('hola@example.com');
      fixture.detectChanges();
      expect(nativeInput().value).toBe('hola@example.com');
    });

    it('writeValue(null) clears the native input value', () => {
      fixture.componentInstance.writeValue('hola@example.com');
      fixture.detectChanges();
      fixture.componentInstance.writeValue(null);
      fixture.detectChanges();
      expect(nativeInput().value).toBe('');
    });

    it('calls the registered onChange callback with the new value when the user types', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnChange(spy);

      const el = nativeInput();
      el.value = 'typed value';
      el.dispatchEvent(new Event('input'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledWith('typed value');
    });

    it('calls the registered onTouched callback on blur', () => {
      const spy = jest.fn();
      fixture.componentInstance.registerOnTouched(spy);

      nativeInput().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('blurred', () => {
    // Live-preview-then-commit-on-blur callers (e.g. the ad-hoc node label) need to know the
    // blur actually happened; (blur) placed directly on <lib-input> wouldn't fire — native
    // `blur` doesn't bubble, so it never reaches the host from the inner <input>.
    it('emits blurred when the native input loses focus', () => {
      const spy = jest.fn();
      fixture.componentInstance.blurred.subscribe(spy);

      nativeInput().dispatchEvent(new Event('blur'));
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('integration with template-driven forms', () => {
    @Component({
      imports: [InputComponent, FormsModule],
      template: `<lib-input [(ngModel)]="value" label="Correu" />`,
    })
    class HostComponent {
      value = '';
    }

    it('supports two-way [(ngModel)] binding', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [HostComponent],
        providers: [allLucideIconsProvider],
      }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      const input = hostFixture.debugElement.query(By.css('[data-testid="lib-input-native"]')).nativeElement;
      input.value = 'ngmodel value';
      input.dispatchEvent(new Event('input'));
      hostFixture.detectChanges();
      await hostFixture.whenStable();

      expect(hostFixture.componentInstance.value).toBe('ngmodel value');
    });
  });
});
