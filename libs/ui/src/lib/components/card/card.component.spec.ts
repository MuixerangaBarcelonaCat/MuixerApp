import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { provideRouter } from '@angular/router';
import { User } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { CardComponent } from './card.component';

@Component({
  imports: [CardComponent],
  template: `<lib-card>{{ text }}</lib-card>`,
})
class HostComponent {
  text = 'projected body content';
}

describe('CardComponent', () => {
  let fixture: ComponentFixture<CardComponent>;

  const rootEl = () => fixture.debugElement.children[0];
  const bandEl = () => fixture.debugElement.query(By.css('[data-testid="lib-card-band"]'));
  const titleEl = () => fixture.debugElement.query(By.css('[data-testid="lib-card-title"]'));
  const iconEl = () => fixture.debugElement.query(By.css('[data-testid="lib-card-icon"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardComponent, RouterModule],
      providers: [allLucideIconsProvider, provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(CardComponent);
    fixture.detectChanges();
  });

  it('renders as a plain div by default', () => {
    expect(rootEl().nativeElement.tagName).toBe('DIV');
  });

  it('renders projected content', async () => {
    TestBed.resetTestingModule();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [allLucideIconsProvider, provideRouter([])],
    }).compileComponents();
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();
    expect(hostFixture.nativeElement.textContent).toContain('projected body content');
  });

  it('renders no sash band by default', () => {
    expect(bandEl()).toBeNull();
  });

  describe('body padding — the band is position:absolute and removed from flow, so body must clear it explicitly', () => {
    const bodyEl = () => fixture.debugElement.query(By.css('.body'));

    it('applies no extra top padding when there is no band', () => {
      expect(bodyEl().nativeElement.style.paddingTop).toBe('');
    });

    it('reserves more top padding for the taller "title" band than the "thin" one', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.detectChanges();
      const thinPad = parseFloat(bodyEl().nativeElement.style.paddingTop);

      fixture.componentRef.setInput('sash', 'title');
      fixture.detectChanges();
      const titlePad = parseFloat(bodyEl().nativeElement.style.paddingTop);

      expect(thinPad).toBeGreaterThan(0);
      expect(titlePad).toBeGreaterThan(thinPad);
    });

    it("reserves at least the band's own bottom edge (top offset + height), so content never sits under it", () => {
      fixture.componentRef.setInput('sash', 'title');
      fixture.detectChanges();
      const pad = parseFloat(bodyEl().nativeElement.style.paddingTop);
      const bandBottom = 16 + 38; // BAND_TOP + title band height
      expect(pad).toBeGreaterThanOrEqual(bandBottom);
    });
  });

  describe('sash modes', () => {
    it('renders a thin band with no title text on it for sash="thin"', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.detectChanges();
      expect(bandEl()).toBeTruthy();
      expect(titleEl()).toBeNull();
    });

    it('renders the band and the title on it for sash="title"', () => {
      fixture.componentRef.setInput('sash', 'title');
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.detectChanges();
      expect(bandEl()).toBeTruthy();
      expect(titleEl()).toBeTruthy();
      expect(titleEl().nativeElement.textContent).toContain('Usuaris');
    });

    it('renders the title in the body (not on a band) when sash="none"', () => {
      fixture.componentRef.setInput('sash', 'none');
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.detectChanges();
      expect(bandEl()).toBeNull();
      const bodyTitle = fixture.debugElement.query(By.css('[data-testid="lib-card-body-title"]'));
      expect(bodyTitle.nativeElement.textContent).toContain('Usuaris');
    });
  });

  describe('sash and icon color — defaults to the shared sash token, overridable', () => {
    it('does not set an inline background color on the band by default (CSS reads --ds-sash-fill)', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.detectChanges();
      expect(bandEl().nativeElement.style.backgroundColor).toBe('');
    });

    it('applies a custom sashColor as the band background via inline style', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.componentRef.setInput('sashColor', '#6366f1');
      fixture.detectChanges();
      expect(bandEl().nativeElement.style.backgroundColor).toBe('rgb(99, 102, 241)');
    });

    it('computes readable title/icon color via contrastContent for a custom sashColor, never raw #000/#fff', () => {
      fixture.componentRef.setInput('sash', 'title');
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.componentRef.setInput('sashColor', '#1a1a1a');
      fixture.detectChanges();
      const color = titleEl().nativeElement.style.color;
      expect(color).not.toBe('');
      expect(color).not.toBe('rgb(0, 0, 0)');
      expect(color).not.toBe('rgb(255, 255, 255)');
    });

    it('does not set an inline icon color by default (CSS default applies)', () => {
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.componentRef.setInput('icon', User);
      fixture.detectChanges();
      expect(iconEl().nativeElement.style.color).toBe('');
    });

    it('applies a custom iconColor via inline style', () => {
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.componentRef.setInput('icon', User);
      fixture.componentRef.setInput('iconColor', '#22c55e');
      fixture.detectChanges();
      expect(iconEl().nativeElement.style.color).toBe('rgb(34, 197, 94)');
    });
  });

  describe('sash fringe — the woven threads emerging from the band', () => {
    it('renders fringe thread paths for sash="thin"', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.detectChanges();
      const paths = fixture.debugElement.queryAll(By.css('[data-testid="lib-card-fringe"] path'));
      expect(paths.length).toBeGreaterThan(0);
    });

    it('renders more fringe threads for the taller "title" band than the "thin" one', () => {
      fixture.componentRef.setInput('sash', 'thin');
      fixture.detectChanges();
      const thinCount = fixture.debugElement.queryAll(By.css('[data-testid="lib-card-fringe"] path')).length;

      fixture.componentRef.setInput('sash', 'title');
      fixture.detectChanges();
      const titleCount = fixture.debugElement.queryAll(By.css('[data-testid="lib-card-fringe"] path')).length;

      expect(titleCount).toBeGreaterThan(thinCount);
    });

    it('renders no fringe when there is no band', () => {
      fixture.componentRef.setInput('sash', 'none');
      fixture.detectChanges();
      expect(fixture.debugElement.query(By.css('[data-testid="lib-card-fringe"]'))).toBeNull();
    });
  });

  describe('interactive modes — plain div, routerLink, href, or clickable', () => {
    it('renders a plain div with none of routerLink/href/clickable set', () => {
      expect(rootEl().nativeElement.tagName).toBe('DIV');
    });

    it('renders an anchor with [routerLink] when routerLink is set', () => {
      fixture.componentRef.setInput('routerLink', '/config/tags');
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

    it('renders a native button when clickable is set with no link', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.detectChanges();
      expect(rootEl().nativeElement.tagName).toBe('BUTTON');
    });

    it('emits clicked when the clickable button is clicked', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.clicked.subscribe(spy);

      rootEl().nativeElement.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('still renders the sash and title inside the interactive variants', () => {
      fixture.componentRef.setInput('clickable', true);
      fixture.componentRef.setInput('sash', 'title');
      fixture.componentRef.setInput('title', 'Usuaris');
      fixture.detectChanges();
      expect(titleEl().nativeElement.textContent).toContain('Usuaris');
    });
  });
});
