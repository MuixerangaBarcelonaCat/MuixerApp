import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { FormFieldComponent } from './form-field.component';

describe('FormFieldComponent', () => {
  let fixture: ComponentFixture<FormFieldComponent>;

  const labelEl = () => fixture.debugElement.query(By.css('label'));
  const errorEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-error"]'));
  const hintEl = () => fixture.debugElement.query(By.css('[data-testid="lib-form-field-hint"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FormFieldComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(FormFieldComponent);
    fixture.detectChanges();
  });

  describe('label', () => {
    it('renders no label element when label is not set', () => {
      expect(labelEl()).toBeNull();
    });

    it('renders the label text when label is set', () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('Disponibilitat');
    });

    it("wires the label's for attribute to the given id", () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.componentRef.setInput('id', 'availability-select');
      fixture.detectChanges();
      expect(labelEl().nativeElement.getAttribute('for')).toBe('availability-select');
    });

    it('appends a required marker to the label text when required is set', () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.componentRef.setInput('required', true);
      fixture.detectChanges();
      expect(labelEl().nativeElement.textContent).toContain('*');
    });

    it('shrinks the label text for the xs size', () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      const labelText = fixture.debugElement.query(By.css('.label-text'));
      expect(labelText.nativeElement.className).toContain('text-xs');
    });

    it('leaves the label text at its default size for sm/md/lg', () => {
      fixture.componentRef.setInput('label', 'Disponibilitat');
      fixture.detectChanges();
      const labelText = fixture.debugElement.query(By.css('.label-text'));
      expect(labelText.nativeElement.className).not.toContain('text-xs');
    });
  });

  describe('hint and error — one slot, error wins', () => {
    it('shows nothing below the field by default', () => {
      expect(errorEl()).toBeNull();
      expect(hintEl()).toBeNull();
    });

    it('shows the hint text when hint is set', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      expect(hintEl().nativeElement.textContent).toContain('Opcional.');
      expect(errorEl()).toBeNull();
    });

    it('shows the error text instead of the hint when both are set', () => {
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.componentRef.setInput('errorText', 'Camp obligatori.');
      fixture.detectChanges();
      expect(errorEl().nativeElement.textContent).toContain('Camp obligatori.');
      expect(hintEl()).toBeNull();
    });

    it('exposes a description id derived from the given id, for the projected control to reference via aria-describedby', () => {
      fixture.componentRef.setInput('id', 'availability-select');
      fixture.componentRef.setInput('hint', 'Opcional.');
      fixture.detectChanges();
      expect(hintEl().nativeElement.id).toBe('availability-select-description');
    });
  });

  describe('content projection', () => {
    @Component({
      imports: [FormFieldComponent],
      template: `<lib-form-field label="Disponibilitat"><select data-testid="projected"><option>A</option></select></lib-form-field>`,
    })
    class HostComponent {}

    it('projects the caller-supplied control between the label and the hint/error slot', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();

      const projected = hostFixture.debugElement.query(By.css('[data-testid="projected"]'));
      expect(projected).toBeTruthy();
      expect(projected.nativeElement.tagName).toBe('SELECT');
    });

    // A <label> with no `for` and multiple labelable descendants (several buttons, e.g. Etiquetes'
    // clickable chips) makes browsers forward any click inside it to the *first* one — surfaced as
    // that chip looking permanently stuck mid-hover. The outer wrapper must not be a <label>.
    it('does not wrap the projected content in a <label> — multiple buttons inside one would get ambiguous native click-forwarding', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.detectChanges();

      const projected = hostFixture.debugElement.query(By.css('[data-testid="projected"]'));
      expect(projected.nativeElement.closest('label')).toBeNull();
    });
  });
});
