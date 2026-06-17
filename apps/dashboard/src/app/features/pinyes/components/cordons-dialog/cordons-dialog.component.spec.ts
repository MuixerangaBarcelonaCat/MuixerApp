import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CordonsDialogComponent, CordonsDialogSaveEvent } from './cordons-dialog.component';
import { RenglaModel } from '../../models/figure-template.model';

@Component({
  standalone: true,
  imports: [CordonsDialogComponent],
  template: `
    <app-cordons-dialog
      [open]="open()"
      [numberOfCordons]="numberOfCordons()"
      [openCordons]="openCordons()"
      [rengles]="rengles()"
      [maxCordons]="maxCordons()"
      [nodes]="nodes()"
      (saved)="onSaved($event)"
      (closed)="onClosed()"
    />
  `,
})
class TestHostComponent {
  open = signal(true);
  numberOfCordons = signal<number | null>(null);
  openCordons = signal<string[]>([]);
  rengles = signal<RenglaModel[]>([
    { id: 'r1', name: 'Mans Nord', sortOrder: 0, allowsCordoObert: true },
    { id: 'r2', name: 'Vents Est', sortOrder: 1, allowsCordoObert: true },
  ]);
  maxCordons = signal(3);
  nodes = signal<{ renglaId: string | null; positionType: string | null; renglaPosition: number | null }[]>([]);
  savedEvent: CordonsDialogSaveEvent | null = null;
  closedCalled = false;

  onSaved(event: CordonsDialogSaveEvent): void {
    this.savedEvent = event;
  }
  onClosed(): void {
    this.closedCalled = true;
  }
}

function findButton(fixture: ComponentFixture<TestHostComponent>, text: string): HTMLButtonElement | undefined {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.find((b) => b.textContent?.trim() === text);
}

function findButtonByLabel(fixture: ComponentFixture<TestHostComponent>, label: string): HTMLButtonElement | undefined {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.find((b) => b.getAttribute('aria-label') === label);
}

function findButtonByTextIncludes(fixture: ComponentFixture<TestHostComponent>, text: string): HTMLButtonElement | undefined {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.find((b) => b.textContent?.includes(text));
}

/** Expands the flat rengla list (no nodes provided → single collapsed group). */
function expandFlatList(fixture: ComponentFixture<TestHostComponent>): void {
  findButtonByTextIncludes(fixture, 'Mostra')?.click();
  fixture.detectChanges();
}

describe('CordonsDialogComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  // ── Dialog visibility ────────────────────────────────────────────────────

  it('renders the dialog when open is true', () => {
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeTruthy();
  });

  it('does not render the dialog when open is false', () => {
    host.open.set(false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeNull();
  });

  // ── Cordon count controls ────────────────────────────────────────────────

  it('shows "Tots" when numberOfCordons is null', () => {
    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('Tots');
  });

  it('shows numeric value when numberOfCordons is set', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();
    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('increment button increases the cordon count', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButtonByLabel(fixture, 'Augmentar cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('3');
  });

  it('decrement button decreases the cordon count', () => {
    host.numberOfCordons.set(3);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButtonByLabel(fixture, 'Reduir cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('decrement from null sets to maxCordons - 1', () => {
    findButtonByLabel(fixture, 'Reduir cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('increment is disabled at maxCordons', () => {
    host.numberOfCordons.set(3);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    const btn = findButtonByLabel(fixture, 'Augmentar cordons');
    expect(btn?.disabled).toBe(true);
  });

  // ── Flat rengla list (no nodes → single collapsed group) ────────────────

  it('rengla list starts collapsed — no checkboxes visible initially', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('renders rengla toggles after expanding the flat list', () => {
    expandFlatList(fixture);
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it('collapses the flat list when toggled a second time', () => {
    expandFlatList(fixture);
    findButtonByTextIncludes(fixture, 'Amaga')?.click();
    fixture.detectChanges();

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  it('toggling a rengla checkbox updates openCordons', () => {
    expandFlatList(fixture);
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.openCordons).toContain('r1');
  });

  it('flat list shows open count in the expand button label', () => {
    expandFlatList(fixture);

    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    const expandBtn = findButtonByTextIncludes(fixture, 'Amaga');
    expect(expandBtn?.textContent).toContain('1/2');
  });

  // ── Global activate / deactivate all ────────────────────────────────────

  it('"Activa totes" marks all rengles as open', () => {
    findButton(fixture, 'Activa totes')?.click();
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.openCordons).toEqual(['r1', 'r2']);
  });

  it('"Desactiva totes" clears all open rengles', () => {
    host.openCordons.set(['r1', 'r2']);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButton(fixture, 'Desactiva totes')?.click();
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.openCordons).toEqual([]);
  });

  // ── Save / cancel ────────────────────────────────────────────────────────

  it('emits saved event with correct payload', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent).toEqual({
      numberOfCordons: 2,
      openCordons: [],
    });
  });

  it('emits closed event on cancel', () => {
    findButton(fixture, 'Cancel·lar')?.click();
    fixture.detectChanges();

    expect(host.closedCalled).toBe(true);
  });

  it('"Tots" button sets numberOfCordons to null', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButton(fixture, 'Tots')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('Tots');

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.numberOfCordons).toBeNull();
  });

  // ── No rengles ───────────────────────────────────────────────────────────

  it('does not render rengla section when rengles is empty', () => {
    host.rengles.set([]);
    fixture.detectChanges();
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });

  // ── Grouped view (nodes with multiple positionTypes) ────────────────────

  describe('grouped view', () => {
    beforeEach(() => {
      host.rengles.set([
        { id: 'r1', name: 'Mans Nord', sortOrder: 0, allowsCordoObert: true },
        { id: 'r2', name: 'Mans Sud', sortOrder: 1, allowsCordoObert: true },
        { id: 'r3', name: 'Vents Est', sortOrder: 2, allowsCordoObert: true },
      ]);
      host.nodes.set([
        { renglaId: 'r1', positionType: 'mans', renglaPosition: 1 },
        { renglaId: 'r2', positionType: 'mans', renglaPosition: 1 },
        { renglaId: 'r3', positionType: 'vents', renglaPosition: 1 },
      ]);
      fixture.detectChanges();
    });

    it('renders group expand buttons instead of a single flat toggle', () => {
      const expandedBtns = fixture.nativeElement.querySelectorAll('[aria-expanded]');
      expect(expandedBtns.length).toBe(2); // "Mans" and "Vents" groups
    });

    it('shows no checkboxes when groups are collapsed', () => {
      const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(0);
    });

    it('shows checkboxes for the expanded group only', () => {
      const groupBtns: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('[aria-expanded]'));
      groupBtns[0].click(); // expand first group (Mans)
      fixture.detectChanges();

      const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
      expect(checkboxes.length).toBe(2); // r1 + r2 in "mans" group
    });

    it('"Activa" on a group activates only its rengles', () => {
      const activaBtns = fixture.nativeElement.querySelectorAll('button.btn-xs.btn-ghost');
      // First "Activa" button is global "Activa totes", next are per-group
      const groupActivaBtns = (Array.from(activaBtns) as HTMLButtonElement[]).filter(
        (b) => b.textContent?.trim() === 'Activa',
      );
      groupActivaBtns[0].click(); // activate first group (Mans)
      fixture.detectChanges();

      findButton(fixture, 'Desar')?.click();
      fixture.detectChanges();

      expect(host.savedEvent?.openCordons).toContain('r1');
      expect(host.savedEvent?.openCordons).toContain('r2');
      expect(host.savedEvent?.openCordons).not.toContain('r3');
    });

    it('"Desactiva" on a group deactivates only its rengles', () => {
      host.openCordons.set(['r1', 'r2', 'r3']);
      host.open.set(false);
      fixture.detectChanges();
      host.open.set(true);
      fixture.detectChanges();

      const desactivaBtns = (Array.from(
        fixture.nativeElement.querySelectorAll('button.btn-xs.btn-ghost'),
      ) as HTMLButtonElement[]).filter((b) => b.textContent?.trim() === 'Desactiva');
      desactivaBtns[0].click(); // deactivate first group (Mans)
      fixture.detectChanges();

      findButton(fixture, 'Desar')?.click();
      fixture.detectChanges();

      expect(host.savedEvent?.openCordons).not.toContain('r1');
      expect(host.savedEvent?.openCordons).not.toContain('r2');
      expect(host.savedEvent?.openCordons).toContain('r3');
    });
  });
});
