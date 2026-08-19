import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BadgeComponent } from './badge.component';

describe('BadgeComponent', () => {
  let fixture: ComponentFixture<BadgeComponent>;

  const badgeEl = () => fixture.debugElement.query(By.css('span'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BadgeComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(BadgeComponent);
    fixture.detectChanges();
  });

  it('renders projected content inside a native span element', () => {
    const el = badgeEl();
    expect(el).toBeTruthy();
    expect(el.nativeElement.tagName).toBe('SPAN');
  });

  it('defaults to the neutral variant', () => {
    expect(badgeEl().nativeElement.className).toContain('badge-neutral');
  });

  it.each([
    ['primary', 'badge-primary'],
    ['secondary', 'badge-secondary'],
    ['accent', 'badge-accent'],
    ['ghost', 'badge-ghost'],
    ['info', 'badge-info'],
    ['success', 'badge-success'],
    ['warning', 'badge-warning'],
    ['error', 'badge-error'],
  ] as const)('applies the %s variant class', (variant, expectedClass) => {
    fixture.componentRef.setInput('variant', variant);
    fixture.detectChanges();
    expect(badgeEl().nativeElement.className).toContain(expectedClass);
  });

  it('applies no size class for the default md size', () => {
    const className = badgeEl().nativeElement.className;
    expect(className).not.toContain('badge-xs');
    expect(className).not.toContain('badge-sm');
    expect(className).not.toContain('badge-lg');
  });

  it.each([
    ['xs', 'badge-xs'],
    ['sm', 'badge-sm'],
    ['lg', 'badge-lg'],
  ] as const)('applies the %s size class', (size, expectedClass) => {
    fixture.componentRef.setInput('size', size);
    fixture.detectChanges();
    expect(badgeEl().nativeElement.className).toContain(expectedClass);
  });

  describe('custom color — for domain data like tag colors, not the fixed variant palette', () => {
    it('applies the custom color as the background via inline style, not a variant class', () => {
      fixture.componentRef.setInput('color', '#6366f1');
      fixture.detectChanges();
      const el = badgeEl().nativeElement;
      expect(el.style.backgroundColor).toBe('rgb(99, 102, 241)');
      expect(el.className).not.toContain('badge-neutral');
    });

    it('computes readable content color via contrastContent — never a raw #000/#fff', () => {
      fixture.componentRef.setInput('color', '#1a1a1a'); // very dark custom color
      fixture.detectChanges();
      const el = badgeEl().nativeElement;
      expect(el.style.color).not.toBe('rgb(0, 0, 0)');
      expect(el.style.color).not.toBe('rgb(255, 255, 255)');
    });

    it('falls back to the variant class when no custom color is given', () => {
      expect(badgeEl().nativeElement.className).toContain('badge-neutral');
      expect(badgeEl().nativeElement.style.backgroundColor).toBe('');
    });

    it('uses the custom color for text/border instead of a fill when combined with outline', () => {
      fixture.componentRef.setInput('color', '#6366f1');
      fixture.componentRef.setInput('outline', true);
      fixture.detectChanges();
      const el = badgeEl().nativeElement;
      expect(el.style.backgroundColor).toBe('');
      expect(el.style.borderColor).toBe('rgb(99, 102, 241)');
      expect(el.style.color).toBe('rgb(99, 102, 241)');
    });

    it('leaves text color unset (ambient theme color) instead of the tag hex when readableOutlineText is set — border stays in the tag color', () => {
      fixture.componentRef.setInput('color', '#6366f1');
      fixture.componentRef.setInput('outline', true);
      fixture.componentRef.setInput('readableOutlineText', true);
      fixture.detectChanges();
      const el = badgeEl().nativeElement;
      expect(el.style.borderColor).toBe('rgb(99, 102, 241)');
      expect(el.style.color).toBe('');
    });
  });

  describe('outline — a modifier combined with variant, not a variant of its own', () => {
    it('adds no outline class by default', () => {
      expect(badgeEl().nativeElement.className).not.toContain('badge-outline');
    });

    it('combines badge-outline with the current variant class when set', () => {
      fixture.componentRef.setInput('variant', 'warning');
      fixture.componentRef.setInput('outline', true);
      fixture.detectChanges();
      const className = badgeEl().nativeElement.className;
      expect(className).toContain('badge-warning');
      expect(className).toContain('badge-outline');
    });
  });

  describe('content projection — via a real host, not the bare fixture used above', () => {
    @Component({
      imports: [BadgeComponent],
      template: `<lib-badge [clickable]="clickable">{{ label }}</lib-badge>`,
    })
    class HostComponent {
      clickable = false;
      label = 'Etiqueta';
    }

    // clickable is fixed at creation time (never toggled post-render) — zoneless change detection
    // throws a spurious NG0100 if a host's plain field is mutated between two detectChanges()
    // calls (unrelated to what's under test here; the same gotcha Modal's own spec hit).
    async function setupHost(clickable: boolean) {
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
      const hostFixture = TestBed.createComponent(HostComponent);
      hostFixture.componentInstance.clickable = clickable;
      hostFixture.detectChanges();
      return hostFixture;
    }

    it('projects content into the static span', async () => {
      const hostFixture = await setupHost(false);
      const span = hostFixture.debugElement.query(By.css('span'));
      expect(span.nativeElement.textContent.trim()).toBe('Etiqueta');
    });

    it('projects content into the clickable button — the same <ng-content> cannot just be duplicated across an @if/@else, per this lib\'s own Button/Card precedent', async () => {
      const hostFixture = await setupHost(true);
      const button = hostFixture.debugElement.query(By.css('button'));
      expect(button.nativeElement.textContent.trim()).toBe('Etiqueta');
    });
  });

  describe('clickable — an interactive toggle-chip mode, not the default static label', () => {
    it('renders a span, not a button, when not clickable', () => {
      expect(fixture.debugElement.query(By.css('button'))).toBeNull();
      expect(badgeEl()).toBeTruthy();
    });

    it('renders a native button instead of a span when clickable', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.detectChanges();
      const button = fixture.debugElement.query(By.css('button'));
      expect(button).toBeTruthy();
      expect(button.nativeElement.getAttribute('type')).toBe('button');
      expect(fixture.debugElement.query(By.css('span.badge'))).toBeNull();
    });

    it('emits clicked when the button is clicked', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      (fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement).click();

      expect(spy).toHaveBeenCalled();
    });

    it('renders an unselected clickable chip outline-only and marks aria-pressed false', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.detectChanges();
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.className).toContain('badge-outline');
      expect(button.getAttribute('aria-pressed')).toBe('false');
    });

    it('renders a selected clickable chip filled (not outline) and marks aria-pressed true', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.componentRef.setInput('selected', true);
      fixture.detectChanges();
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.className).not.toContain('badge-outline');
      expect(button.getAttribute('aria-pressed')).toBe('true');
    });

    it('sets aria-label on the button when ariaLabel is provided (e.g. an emoji chip with no readable text)', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.componentRef.setInput('ariaLabel', 'Emoji ⚠️');
      fixture.detectChanges();
      const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
      expect(button.getAttribute('aria-label')).toBe('Emoji ⚠️');
    });

    it('ignores selected when not clickable — a static label has no toggle state', () => {
      fixture.componentRef.setInput('selected', true);
      fixture.detectChanges();
      const span = badgeEl().nativeElement as HTMLElement;
      expect(span.className).not.toContain('badge-outline');
      expect(span.getAttribute('aria-pressed')).toBeNull();
    });

    it('never forces a min-h-6 tap target — a clickable badge matches a static one at the same size', () => {
      for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
        fixture.componentRef.setInput('clickable', true);
        fixture.componentRef.setInput('size', size);
        fixture.detectChanges();
        const button = fixture.debugElement.query(By.css('button')).nativeElement as HTMLButtonElement;
        expect(button.className).not.toContain('min-h-6');
      }
    });
  });
});
