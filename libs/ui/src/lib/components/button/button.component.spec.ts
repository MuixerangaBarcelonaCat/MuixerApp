import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule, provideRouter } from '@angular/router';
import { ButtonComponent } from './button.component';

@Component({ template: '' })
class StubRouteComponent {}

describe('ButtonComponent', () => {
  let fixture: ComponentFixture<ButtonComponent>;

  const rootEl = () => fixture.debugElement.children[0];
  const buttonEl = () => fixture.debugElement.query(By.css('button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ButtonComponent, RouterModule],
      providers: [provideRouter([{ path: '**', component: StubRouteComponent }])],
    }).compileComponents();
    fixture = TestBed.createComponent(ButtonComponent);
    fixture.detectChanges();
  });

  it('renders projected content inside a native button element', () => {
    fixture.nativeElement.querySelector('button');
    const el = buttonEl();
    expect(el).toBeTruthy();
    expect(el.nativeElement.tagName).toBe('BUTTON');
  });

  it('defaults to the primary variant', () => {
    expect(buttonEl().nativeElement.className).toContain('btn-primary');
  });

  it.each([
    ['secondary', 'btn-secondary'],
    ['accent', 'btn-accent'],
    ['neutral', 'btn-neutral'],
    ['ghost', 'btn-ghost'],
    ['info', 'btn-info'],
    ['success', 'btn-success'],
    ['warning', 'btn-warning'],
    ['error', 'btn-error'],
  ] as const)('applies the %s variant class', (variant, expectedClass) => {
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    expect(buttonEl().nativeElement.className).toContain(expectedClass);
  });

  describe('outline — a modifier combined with variant, not a variant of its own', () => {
    it('adds no outline class by default', () => {
      expect(buttonEl().nativeElement.className).not.toContain('btn-outline');
    });

    it('combines btn-outline with the current variant class when set', () => {
      fixture.componentRef.setInput('variant', 'warning');
      fixture.componentRef.setInput('outline', true);
      fixture.detectChanges();
      const className = buttonEl().nativeElement.className;
      expect(className).toContain('btn-warning');
      expect(className).toContain('btn-outline');
    });
  });

  it('applies no size class for the default md size', () => {
    const className = buttonEl().nativeElement.className;
    expect(className).not.toContain('btn-xs');
    expect(className).not.toContain('btn-sm');
    expect(className).not.toContain('btn-lg');
  });

  it.each([
    ['xs', 'btn-xs'],
    ['sm', 'btn-sm'],
    ['lg', 'btn-lg'],
  ] as const)('applies the %s size class', (size, expectedClass) => {
    fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    expect(buttonEl().nativeElement.className).toContain(expectedClass);
  });

  it('applies no shape class for the default shape', () => {
    const className = buttonEl().nativeElement.className;
    expect(className).not.toContain('btn-square');
    expect(className).not.toContain('btn-circle');
  });

  it.each([
    ['square', 'btn-square'],
    ['circle', 'btn-circle'],
  ] as const)('applies the %s shape class', (shape, expectedClass) => {
    fixture.componentRef.setInput('shape', shape);
    fixture.componentRef.setInput('ariaLabel', 'Tanca');
    fixture.detectChanges();
    expect(buttonEl().nativeElement.className).toContain(expectedClass);
  });

  it('defaults the native button type to "button", never a form submit', () => {
    expect(buttonEl().nativeElement.type).toBe('button');
  });

  it('sets the native button type when overridden', () => {
    fixture.componentRef.setInput('type', 'submit');
    fixture.detectChanges();
    expect(buttonEl().nativeElement.type).toBe('submit');
  });

  describe('disabled', () => {
    it('is not disabled by default', () => {
      expect(buttonEl().nativeElement.disabled).toBe(false);
    });

    it('sets the native disabled attribute when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.disabled).toBe(true);
    });

    it('does not emit clicked when disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      buttonEl().nativeElement.click();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('loading', () => {
    const spinnerEl = () => fixture.debugElement.query(By.css('[data-testid="lib-button-spinner"]'));

    it('renders no spinner by default', () => {
      expect(spinnerEl()).toBeNull();
    });

    it('renders a spinner sized to match the button when loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.componentRef.setInput('size', 'lg');
      fixture.detectChanges();
      expect(spinnerEl().nativeElement.className).toContain('loading-lg');
    });

    it('also disables the native button when loading, so it cannot be double-submitted', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.disabled).toBe(true);
    });

    it('does not emit clicked while loading', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      buttonEl().nativeElement.click();

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('interaction', () => {
    it('emits clicked when clicked', () => {
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      buttonEl().nativeElement.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('icon-only accessibility', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('warns when shape is circle and no ariaLabel is provided', () => {
      fixture.componentRef.setInput('shape', 'circle');
      fixture.detectChanges();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ariaLabel'));
    });

    it('warns when shape is square and no ariaLabel is provided', () => {
      fixture.componentRef.setInput('shape', 'square');
      fixture.detectChanges();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('ariaLabel'));
    });

    it('does not warn when shape is circle and ariaLabel is provided', () => {
      fixture.componentRef.setInput('shape', 'circle');
      fixture.componentRef.setInput('ariaLabel', 'Tanca');
      fixture.detectChanges();
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('does not warn for the default (text) shape, even without ariaLabel', () => {
      fixture.detectChanges();
      expect(warnSpy).not.toHaveBeenCalled();
    });
  });

  describe('link mode — routerLink/href, mirroring lib-card', () => {
    it('renders a native button with neither routerLink nor href set', () => {
      expect(rootEl().nativeElement.tagName).toBe('BUTTON');
    });

    it('renders an anchor with [routerLink] when routerLink is set', () => {
      fixture.componentRef.setInput('routerLink', '/sync');
      fixture.detectChanges();
      expect(rootEl().nativeElement.tagName).toBe('A');
    });

    it('renders an anchor with [href] when href is set', () => {
      fixture.componentRef.setInput('href', 'https://example.com');
      fixture.detectChanges();
      const el = rootEl().nativeElement;
      expect(el.tagName).toBe('A');
      expect(el.getAttribute('href')).toBe('https://example.com');
    });

    it('routerLink takes priority when both routerLink and href are set', () => {
      fixture.componentRef.setInput('routerLink', '/sync');
      fixture.componentRef.setInput('href', 'https://example.com');
      fixture.detectChanges();
      const el = rootEl().nativeElement;
      expect(el.tagName).toBe('A');
      expect(el.getAttribute('href')).toBe('/sync');
    });

    it('applies the same variant/size/outline classes as button mode', () => {
      fixture.componentRef.setInput('routerLink', '/sync');
      fixture.componentRef.setInput('variant', 'warning');
      fixture.componentRef.setInput('size', 'sm');
      fixture.componentRef.setInput('outline', true);
      fixture.detectChanges();
      const className = rootEl().nativeElement.className;
      expect(className).toContain('btn-warning');
      expect(className).toContain('btn-sm');
      expect(className).toContain('btn-outline');
    });

    it('emits clicked when the link is clicked', () => {
      fixture.componentRef.setInput('routerLink', '/sync');
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      rootEl().nativeElement.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('throws when disabled is combined with routerLink — a disabled link is not a supported shape', () => {
      fixture.componentRef.setInput('routerLink', '/sync');
      fixture.componentRef.setInput('disabled', true);
      expect(() => fixture.detectChanges()).toThrow(/disabled/);
    });

    it('throws when loading is combined with href — a loading link is not a supported shape', () => {
      fixture.componentRef.setInput('href', 'https://example.com');
      fixture.componentRef.setInput('loading', true);
      expect(() => fixture.detectChanges()).toThrow(/loading/);
    });
  });
});
