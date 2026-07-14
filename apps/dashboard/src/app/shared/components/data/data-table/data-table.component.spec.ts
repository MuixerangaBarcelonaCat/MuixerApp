import { ComponentFixture, TestBed } from '@angular/core/testing';
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
});
