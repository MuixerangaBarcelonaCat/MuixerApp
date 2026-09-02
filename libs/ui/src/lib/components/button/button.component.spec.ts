import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule, provideRouter } from '@angular/router';
import { ButtonComponent } from './button.component';

@Component({ template: '' })
class StubRouteComponent {}

@Component({
  imports: [ButtonComponent],
  template: `
    <div class="join">
      <lib-button joinItem>A</lib-button>
      <lib-button joinItem>B</lib-button>
    </div>
  `,
})
class JoinItemHostComponent {}

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

  describe('tooltip — forwarded to the rendered control (host has display:contents)', () => {
    it('sets no title by default', () => {
      expect(buttonEl().nativeElement.hasAttribute('title')).toBe(false);
    });

    it('forwards the tooltip input to the inner button as a title attribute', () => {
      fixture.componentRef.setInput('tooltip', 'Ajuda');
      fixture.detectChanges();
      expect(buttonEl().nativeElement.getAttribute('title')).toBe('Ajuda');
    });

    it('mirrors ariaLabel into the title so it shows as a hover tooltip', () => {
      fixture.componentRef.setInput('ariaLabel', 'Elimina el segment');
      fixture.detectChanges();
      expect(buttonEl().nativeElement.getAttribute('title')).toBe('Elimina el segment');
    });

    it('lets an explicit empty tooltip opt out of the ariaLabel mirror', () => {
      fixture.componentRef.setInput('ariaLabel', 'Elimina el segment');
      fixture.componentRef.setInput('tooltip', '');
      fixture.detectChanges();
      expect(buttonEl().nativeElement.hasAttribute('title')).toBe(false);
    });

    it('picks up a static title attribute written on the host element', async () => {
      TestBed.resetTestingModule();
      @Component({ imports: [ButtonComponent], template: `<lib-button title="Desa">X</lib-button>` })
      class HostTitleComponent {}
      await TestBed.configureTestingModule({
        imports: [HostTitleComponent, RouterModule],
        providers: [provideRouter([{ path: '**', component: StubRouteComponent }])],
      }).compileComponents();
      const hostFixture = TestBed.createComponent(HostTitleComponent);
      hostFixture.detectChanges();
      expect(hostFixture.debugElement.query(By.css('button')).nativeElement.getAttribute('title')).toBe('Desa');
    });
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

  describe('ghost — btn-ghost box with the variant\'s role colour kept as text', () => {
    it('adds no ghost class by default', () => {
      const className = buttonEl().nativeElement.className;
      expect(className).not.toContain('btn-ghost');
      expect(className).not.toContain('text-error');
    });

    it('renders btn-ghost plus the variant\'s text colour, and no fill/outline', () => {
      fixture.componentRef.setInput('variant', 'error');
      fixture.componentRef.setInput('ghost', true);
      fixture.detectChanges();
      const className = buttonEl().nativeElement.className;
      expect(className).toContain('btn-ghost');
      expect(className).toContain('text-error');
      expect(className).not.toContain('btn-error');
      expect(className).not.toContain('btn-outline');
    });

    it('wins over outline when both are set', () => {
      fixture.componentRef.setInput('variant', 'error');
      fixture.componentRef.setInput('ghost', true);
      fixture.componentRef.setInput('outline', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).not.toContain('btn-outline');
    });
  });

  describe('joinItem/active — lib-button-group\'s own markers on the real rendered element', () => {
    it('adds no join-item class by default', () => {
      expect(buttonEl().nativeElement.className).not.toContain('join-item');
    });

    it('adds join-item when set', () => {
      fixture.componentRef.setInput('joinItem', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).toContain('join-item');
    });

    it('never adds DaisyUI\'s own btn-active (darkened fill) — selected state is outline-vs-filled instead', () => {
      fixture.componentRef.setInput('joinItem', true);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).not.toContain('btn-active');
    });

    it('outlines an unselected joinItem segment (no active) — matches lib-badge\'s clickable/selected treatment', () => {
      fixture.componentRef.setInput('joinItem', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).toContain('btn-outline');
    });

    it('fills a selected (active) joinItem segment — no btn-outline', () => {
      fixture.componentRef.setInput('joinItem', true);
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).not.toContain('btn-outline');
    });

    it('active alone (no joinItem) has no outline effect — only meaningful inside a segmented group', () => {
      fixture.componentRef.setInput('active', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).not.toContain('btn-outline');
    });

    it('throws when joinItem is combined with variant="ghost" — ghost has no fill/border to show selection either way', () => {
      fixture.componentRef.setInput('joinItem', true);
      fixture.componentRef.setInput('variant', 'ghost');
      expect(() => fixture.detectChanges()).toThrow(/ghost/);
    });

    it('does not throw for variant="ghost" alone (no joinItem) — a plain ghost button is fine', () => {
      fixture.componentRef.setInput('variant', 'ghost');
      expect(() => fixture.detectChanges()).not.toThrow();
    });

    describe('outlineMode — selected=outline, unselected=ghost, instead of the default selected=filled, unselected=outline', () => {
      it('outlines a selected (active) segment instead of filling it', () => {
        fixture.componentRef.setInput('variant', 'secondary');
        fixture.componentRef.setInput('joinItem', true);
        fixture.componentRef.setInput('outlineMode', true);
        fixture.componentRef.setInput('active', true);
        fixture.detectChanges();
        const className = buttonEl().nativeElement.className;
        expect(className).toContain('btn-secondary');
        expect(className).toContain('btn-outline');
      });

      it('renders an unselected segment as plain ghost — not the button\'s own variant color at all', () => {
        fixture.componentRef.setInput('variant', 'secondary');
        fixture.componentRef.setInput('joinItem', true);
        fixture.componentRef.setInput('outlineMode', true);
        fixture.detectChanges();
        const className = buttonEl().nativeElement.className;
        expect(className).toContain('btn-ghost');
        expect(className).not.toContain('btn-secondary');
        expect(className).not.toContain('btn-outline');
      });

      it('outlineMode has no effect without joinItem', () => {
        fixture.componentRef.setInput('variant', 'secondary');
        fixture.componentRef.setInput('outlineMode', true);
        fixture.detectChanges();
        const className = buttonEl().nativeElement.className;
        expect(className).toContain('btn-secondary');
        expect(className).not.toContain('btn-ghost');
        expect(className).not.toContain('btn-outline');
      });
    });

    // The doubled-border fix (button.component.scss, :host(:not(:first-child)) .join-item) can't
    // be asserted here: it relies on Angular's compiled :host()/:host-context() selectors, which
    // jsdom's CSS engine doesn't resolve through getComputedStyle (confirmed empirically — the
    // same host/margin setup below reads back '' instead of '-2px', with no other passing test in
    // this codebase asserting getComputedStyle on a :host()-scoped rule either). Real, verified
    // manually in a browser instead of by a unit test — this component still renders correctly,
    // this is a harness gap, not a behavior gap.
    it('renders two joinItem buttons as siblings inside the .join wrapper (structural precondition for the border-collapse CSS)', async () => {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [JoinItemHostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(JoinItemHostComponent);
      hostFixture.detectChanges();

      const buttons = hostFixture.debugElement.queryAll(By.css('.join > lib-button > button.join-item'));
      expect(buttons.length).toBe(2);
    });
  });

  describe('fullWidth', () => {
    it('adds no w-full class by default', () => {
      expect(buttonEl().nativeElement.className).not.toContain('w-full');
    });

    it('adds w-full to the rendered element when set — a class on the host tag itself is inert (display: contents)', () => {
      fixture.componentRef.setInput('fullWidth', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).toContain('w-full');
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

  it('does not set aria-expanded or aria-pressed by default', () => {
    expect(buttonEl().nativeElement.hasAttribute('aria-expanded')).toBe(false);
    expect(buttonEl().nativeElement.hasAttribute('aria-pressed')).toBe(false);
  });

  it('sets aria-expanded when provided, for disclosure/collapse toggles', () => {
    fixture.componentRef.setInput('ariaExpanded', true);
    fixture.detectChanges();
    expect(buttonEl().nativeElement.getAttribute('aria-expanded')).toBe('true');
  });

  it('sets aria-pressed when provided, for toggle buttons', () => {
    fixture.componentRef.setInput('ariaPressed', false);
    fixture.detectChanges();
    expect(buttonEl().nativeElement.getAttribute('aria-pressed')).toBe('false');
  });

  it('does not set aria-controls by default', () => {
    expect(buttonEl().nativeElement.hasAttribute('aria-controls')).toBe(false);
  });

  it('sets aria-controls when provided, for a disclosure toggle pointing at the region it expands', () => {
    fixture.componentRef.setInput('ariaControls', 'segment-conflict-panel-body');
    fixture.detectChanges();
    expect(buttonEl().nativeElement.getAttribute('aria-controls')).toBe('segment-conflict-panel-body');
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

    it('marks the button with a loading class so the disabled-look CSS can be suppressed for it (loading reads as "busy", not "disabled")', () => {
      fixture.componentRef.setInput('loading', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).toContain('lib-btn-loading');
    });

    it('adds no loading class when not loading, even if disabled', () => {
      fixture.componentRef.setInput('disabled', true);
      fixture.detectChanges();
      expect(buttonEl().nativeElement.className).not.toContain('lib-btn-loading');
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

  describe('autofocus', () => {
    it('does not steal focus by default', () => {
      expect(document.activeElement).not.toBe(buttonEl().nativeElement);
    });

    it('focuses the native button when autofocus is set', () => {
      const other = TestBed.createComponent(ButtonComponent);
      other.componentRef.setInput('autofocus', true);
      other.detectChanges();
      const otherButton = other.debugElement.query(By.css('button')).nativeElement;
      expect(document.activeElement).toBe(otherButton);
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
