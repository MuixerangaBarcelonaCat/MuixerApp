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
});
