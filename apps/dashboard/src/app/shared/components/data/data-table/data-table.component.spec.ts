import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { DataTableComponent, RowAction } from './data-table.component';
import { ColumnDef } from '../../../models/column-def.model';

interface Row {
  id: string;
  tags: { text: string; color: string }[];
  active?: boolean;
}

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent<Row>>;

  const columns: ColumnDef<Row>[] = [
    {
      key: 'tags',
      label: 'Etiquetes',
      defaultVisible: true,
      type: 'colorBadges',
      colorBadges: (row) => row.tags.map(t => ({ text: t.text, color: t.color })),
    },
  ];

  const items: Row[] = [
    { id: '1', tags: [{ text: 'Pinya', color: '#ff0000' }, { text: 'Base', color: '#00ff00' }] },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<Row>);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('columns', columns);
    fixture.detectChanges();
  });

  it('renders one colored badge per entry with its background and contrast text color', () => {
    const badges = fixture.nativeElement.querySelectorAll('.badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent.trim()).toBe('Pinya');
    expect(badges[0].style.backgroundColor).toBe('rgb(255, 0, 0)');
    expect(badges[0].style.color).toBe('rgb(255, 255, 255)');
    expect(badges[1].textContent.trim()).toBe('Base');
    expect(badges[1].style.backgroundColor).toBe('rgb(0, 255, 0)');
  });
});

interface PillRow {
  id: string;
  pills: { text: string; class: string }[];
}

/**
 * Pills are a positional list, so two of them may legitimately carry the same label —
 * e.g. a participation cell showing one person placed on two same-named nodes of two
 * instances of the same figure. These tests pin that behaviour down; the `track $index`
 * expression in the template is what keeps repeated labels each rendering as their own
 * node instead of being treated as one identity.
 */
describe('DataTableComponent pills', () => {
  const setup = async (pills: { text: string; class: string }[]) => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    const fixture = TestBed.createComponent(DataTableComponent<PillRow>);
    fixture.componentRef.setInput('items', [{ id: '1', pills }]);
    fixture.componentRef.setInput('columns', [
      {
        key: 'pills',
        label: 'Posicions',
        defaultVisible: true,
        type: 'pills',
        pills: (row: PillRow) => row.pills,
      } as ColumnDef<PillRow>,
    ]);
    fixture.detectChanges();
    return fixture;
  };

  it('renders one span per pill with its own class', async () => {
    const fixture = await setup([
      { text: 'Mans C2', class: 'text-base-content' },
      { text: '4d7', class: 'text-base-content/50' },
    ]);

    const spans = fixture.nativeElement.querySelectorAll('td span span');
    expect(spans.length).toBe(2);
    expect(spans[0].textContent.trim()).toBe('Mans C2');
    expect(spans[0].className).toContain('text-base-content');
  });

  it('renders repeated pill labels', async () => {
    const fixture = await setup([
      { text: '⚠', class: 'text-warning' },
      { text: 'Mans C2 · 4d7', class: 'text-warning' },
      { text: 'Mans C2 · 4d7', class: 'text-warning' },
    ]);

    const spans = Array.from(
      fixture.nativeElement.querySelectorAll('td span span'),
    ) as HTMLElement[];
    expect(spans.length).toBe(3);
    expect(spans.filter((s) => s.textContent?.trim() === 'Mans C2 · 4d7').length).toBe(2);
  });

  /**
   * Reconciliation case: the list grows and gains a repeated label, which is what
   * happens when the participation matrix reloads or switches segment scope.
   */
  it('re-renders correctly when a repeated label appears on update', async () => {
    const fixture = await setup([{ text: 'Mans C2 · 4d7', class: 'text-warning' }]);

    expect(() => {
      fixture.componentRef.setInput('items', [
        {
          id: '1',
          pills: [
            { text: 'Mans C2 · 4d7', class: 'text-warning' },
            { text: 'Mans C2 · 4d7', class: 'text-warning' },
          ],
        },
      ]);
      fixture.detectChanges();
    }).not.toThrow();

    const spans = Array.from(
      fixture.nativeElement.querySelectorAll('td span span'),
    ) as HTMLElement[];
    expect(spans.length).toBe(2);
  });
});

describe('DataTableComponent row actions', () => {
  let fixture: ComponentFixture<DataTableComponent<Row>>;

  const columns: ColumnDef<Row>[] = [
    { key: 'id', label: 'Id', defaultVisible: true },
  ];

  const items: Row[] = [
    { id: 'active-1', tags: [], active: true },
    { id: 'inactive-1', tags: [], active: false },
  ];

  const rowActions: RowAction<Row>[] = [
    {
      label: (item) => (item.active ? 'Desactivar' : 'Activar'),
      icon: (item) => (item.active ? 'UserX' : 'UserCheck'),
      action: () => undefined,
    },
    {
      label: 'Sempre visible',
      hidden: (item) => !item.active,
      action: () => undefined,
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<Row>);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rowActions', rowActions);
    fixture.detectChanges();
  });

  function openMenuForRow(index: number) {
    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[aria-label="Accions"]'),
    );
    buttons[index].click();
    fixture.detectChanges();
  }

  function menuLabels(): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('[role="menuitem"]')).map(
      (el) => (el as HTMLElement).textContent?.trim(),
    ) as string[];
  }

  it('resolves a function-based label per row', () => {
    openMenuForRow(0);
    expect(menuLabels()).toContain('Desactivar');

    openMenuForRow(0); // close
    openMenuForRow(1);
    expect(menuLabels()).toContain('Activar');
  });

  it('hides an action for a row when hidden() returns true', () => {
    openMenuForRow(0);
    expect(menuLabels()).toContain('Sempre visible');

    openMenuForRow(0); // close
    openMenuForRow(1);
    expect(menuLabels()).not.toContain('Sempre visible');
  });

  it('renders each action inline with a tooltip and no «⋯» menu when inlineActions is set', () => {
    fixture.componentRef.setInput('inlineActions', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Accions"]')).toBeNull();

    const titles = Array.from(
      fixture.nativeElement.querySelectorAll('td [title]'),
    ).map((el) => (el as HTMLElement).getAttribute('title'));
    // Row 0 is active: both actions visible. Row 1: the `hidden` one is dropped.
    expect(titles).toEqual(['Desactivar', 'Sempre visible', 'Activar']);
  });

  it('runs the action when its inline button is clicked', () => {
    const spy = vi.spyOn(rowActions[0], 'action');
    fixture.componentRef.setInput('inlineActions', true);
    fixture.detectChanges();

    fixture.nativeElement.querySelector('td [title="Desactivar"]').click();
    expect(spy).toHaveBeenCalledWith(items[0]);
  });
});

describe('DataTableComponent card mode (< lg)', () => {
  let fixture: ComponentFixture<DataTableComponent<CardRow>>;
  const originalMatchMedia = window.matchMedia;

  interface CardRow {
    id: string;
    name: string;
    status: string;
    tags: { text: string; color: string }[];
    active: boolean;
  }

  const columns: ColumnDef<CardRow>[] = [
    { key: 'name', label: 'Nom', defaultVisible: true, primary: true },
    { key: 'status', label: 'Estat', defaultVisible: true },
    {
      key: 'tags',
      label: 'Etiquetes',
      defaultVisible: true,
      type: 'colorBadges',
      colorBadges: (row) => row.tags.map((t) => ({ text: t.text, color: t.color })),
    },
  ];

  const items: CardRow[] = [
    { id: '1', name: 'ADRI', status: 'Actiu', tags: [{ text: 'Pinya', color: '#ff0000' }], active: true },
    { id: '2', name: 'AINA', status: 'Inactiu', tags: [], active: false },
  ];

  const rowActions: RowAction<CardRow>[] = [
    { label: 'Veure detall', icon: 'Eye', action: () => undefined },
  ];

  beforeEach(async () => {
    // Force card mode: the component reads matchMedia() in its constructor.
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    await TestBed.configureTestingModule({
      imports: [DataTableComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();

    fixture = TestBed.createComponent(DataTableComponent<CardRow>);
    fixture.componentRef.setInput('items', items);
    fixture.componentRef.setInput('columns', columns);
    fixture.componentRef.setInput('rowActions', rowActions);
    fixture.detectChanges();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('activates card mode when the viewport is below lg', () => {
    expect(fixture.componentInstance.cardMode()).toBe(true);
    // No table is rendered in card mode.
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('renders one card per item with the primary column as title', () => {
    const titles = Array.from(
      fixture.nativeElement.querySelectorAll('.card .font-semibold'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(titles).toEqual(['ADRI', 'AINA']);
  });

  it('renders the non-primary columns as label → value rows', () => {
    const labels = Array.from(fixture.nativeElement.querySelectorAll('dt')).map(
      (el) => (el as HTMLElement).textContent?.trim(),
    );
    // Two body columns (Estat, Etiquetes) per card, two cards.
    expect(labels).toEqual(['Estat', 'Etiquetes', 'Estat', 'Etiquetes']);
    expect(fixture.nativeElement.textContent).toContain('Actiu');
  });

  it('renders colorBadges once (no duplicate DOM from the table layout)', () => {
    const badges = fixture.nativeElement.querySelectorAll('.badge');
    expect(badges.length).toBe(1);
    expect((badges[0] as HTMLElement).textContent?.trim()).toBe('Pinya');
    expect((badges[0] as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
  });

  it('keeps the row-actions menu reachable from each card', () => {
    const triggers: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('[aria-label="Accions"]'),
    );
    expect(triggers.length).toBe(2);
    triggers[0].click();
    fixture.detectChanges();
    const menuLabels = Array.from(
      fixture.nativeElement.querySelectorAll('[role="menuitem"]'),
    ).map((el) => (el as HTMLElement).textContent?.trim());
    expect(menuLabels).toContain('Veure detall');
  });
});
