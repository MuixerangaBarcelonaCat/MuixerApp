import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Bell } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { AlertComponent } from './alert.component';

describe('AlertComponent', () => {
  let fixture: ComponentFixture<AlertComponent>;

  const rootEl = (): HTMLElement => fixture.debugElement.children[0].nativeElement;
  const iconEl = () => fixture.debugElement.query(By.css('lucide-icon'));
  const dismissBtn = () => fixture.debugElement.query(By.css('button[aria-label="Tancar"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AlertComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(AlertComponent);
    fixture.detectChanges();
  });

  it('renders a bare DaisyUI alert box (host is display:contents)', () => {
    expect(rootEl().tagName).toBe('DIV');
    expect(rootEl().classList).toContain('alert');
  });

  describe('variant', () => {
    it('defaults to info: alert-info, role="status", aria-live="polite"', () => {
      expect(rootEl().classList).toContain('alert-info');
      expect(rootEl().getAttribute('role')).toBe('status');
      expect(rootEl().getAttribute('aria-live')).toBe('polite');
    });

    it('error is assertive: alert-error, role="alert", aria-live="assertive"', () => {
      fixture.componentRef.setInput('variant', 'error');
      fixture.detectChanges();
      expect(rootEl().classList).toContain('alert-error');
      expect(rootEl().getAttribute('role')).toBe('alert');
      expect(rootEl().getAttribute('aria-live')).toBe('assertive');
    });

    it('warning is assertive', () => {
      fixture.componentRef.setInput('variant', 'warning');
      fixture.detectChanges();
      expect(rootEl().classList).toContain('alert-warning');
      expect(rootEl().getAttribute('role')).toBe('alert');
    });

    it('success is polite', () => {
      fixture.componentRef.setInput('variant', 'success');
      fixture.detectChanges();
      expect(rootEl().classList).toContain('alert-success');
      expect(rootEl().getAttribute('role')).toBe('status');
    });
  });

  describe('icon', () => {
    it('renders the per-variant icon, marked aria-hidden', () => {
      expect(iconEl()).toBeTruthy();
      expect(iconEl().nativeElement.getAttribute('aria-hidden')).toBe('true');
    });

    it('accepts an explicit icon override', () => {
      fixture.componentRef.setInput('icon', Bell);
      fixture.detectChanges();
      expect(iconEl().componentInstance.img).toBe(Bell);
    });
  });

  describe('title', () => {
    it('renders no title element by default', () => {
      expect(fixture.debugElement.query(By.css('[data-testid="lib-alert-title"]'))).toBeNull();
    });

    it('renders the title when set', () => {
      fixture.componentRef.setInput('title', 'Compte no vinculat');
      fixture.detectChanges();
      const title = fixture.debugElement.query(By.css('[data-testid="lib-alert-title"]'));
      expect(title.nativeElement.textContent).toContain('Compte no vinculat');
    });
  });

  describe('dense', () => {
    it('non-dense (default) carries the shadow-raised token', () => {
      expect(rootEl().classList).toContain('shadow-raised');
    });

    it('dense drops the shadow and adds the compact classes', () => {
      fixture.componentRef.setInput('dense', true);
      fixture.detectChanges();
      expect(rootEl().classList).not.toContain('shadow-raised');
      expect(rootEl().classList).toContain('text-sm');
      expect(rootEl().classList).toContain('py-2');
    });
  });

  describe('dismissible', () => {
    it('renders no dismiss button by default', () => {
      expect(dismissBtn()).toBeNull();
    });

    it('renders a dismiss button labelled "Tancar" when dismissible', () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      expect(dismissBtn()).toBeTruthy();
    });

    it('emits dismissed when the dismiss button is clicked', () => {
      fixture.componentRef.setInput('dismissible', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.dismissed.subscribe(spy);
      dismissBtn().nativeElement.click();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('assertive override', () => {
    it('forces role="alert"/assertive on an otherwise-polite variant', () => {
      fixture.componentRef.setInput('variant', 'info');
      fixture.componentRef.setInput('assertive', true);
      fixture.detectChanges();
      expect(rootEl().getAttribute('role')).toBe('alert');
      expect(rootEl().getAttribute('aria-live')).toBe('assertive');
    });
  });
});

@Component({
  template: `
    <lib-alert variant="warning">
      <p>Cos projectat</p>
      <button actions>Acció</button>
    </lib-alert>
  `,
  imports: [AlertComponent],
})
class HostComponent {}

describe('AlertComponent projected content', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('renders content projected into the body', () => {
    expect(fixture.nativeElement.textContent).toContain('Cos projectat');
  });

  it('renders content projected into the [actions] slot', () => {
    expect(fixture.nativeElement.querySelector('button[actions]')?.textContent).toContain('Acció');
  });
});
