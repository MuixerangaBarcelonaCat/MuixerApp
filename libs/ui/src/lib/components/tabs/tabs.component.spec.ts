import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Shapes } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { TabsComponent, TabDef } from './tabs.component';

describe('TabsComponent', () => {
  let fixture: ComponentFixture<TabsComponent>;

  const TABS: TabDef[] = [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ];

  const tablist = () => fixture.debugElement.query(By.css('[role="tablist"]'));
  const tabButtons = () => fixture.debugElement.queryAll(By.css('[role="tab"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TabsComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(TabsComponent);
    fixture.componentRef.setInput('tabs', TABS);
    fixture.componentRef.setInput('activeId', 'a');
    fixture.detectChanges();
  });

  it('renders one tab per entry with role="tab"', () => {
    expect(tabButtons().length).toBe(3);
  });

  it('marks the active tab with tab-active and aria-selected', () => {
    const buttons = tabButtons();
    expect(buttons[0].nativeElement.className).toContain('tab-active');
    expect(buttons[0].nativeElement.getAttribute('aria-selected')).toBe('true');
    expect(buttons[1].nativeElement.getAttribute('aria-selected')).toBe('false');
  });

  it('defaults to the boxed DaisyUI style', () => {
    expect(tablist().nativeElement.className).toContain('tabs-boxed');
  });

  it('switches to the bordered style', () => {
    fixture.componentRef.setInput('style', 'bordered');
    fixture.detectChanges();
    expect(tablist().nativeElement.className).toContain('tabs-bordered');
  });

  it('emits activeIdChange on click', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activeIdChange.subscribe((id: string) => emitted.push(id));
    tabButtons()[1].nativeElement.click();
    expect(emitted).toEqual(['b']);
  });

  it('does not emit when clicking the already-active tab', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activeIdChange.subscribe((id: string) => emitted.push(id));
    tabButtons()[0].nativeElement.click();
    expect(emitted).toEqual([]);
  });

  it('only the active tab is in the tab order (roving tabindex)', () => {
    const buttons = tabButtons();
    expect(buttons[0].nativeElement.tabIndex).toBe(0);
    expect(buttons[1].nativeElement.tabIndex).toBe(-1);
    expect(buttons[2].nativeElement.tabIndex).toBe(-1);
  });

  it('ArrowRight selects the next tab and moves focus to it', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activeIdChange.subscribe((id: string) => emitted.push(id));
    const buttons = tabButtons();
    buttons[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(emitted).toEqual(['b']);
  });

  it('ArrowLeft wraps around from the first tab to the last', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activeIdChange.subscribe((id: string) => emitted.push(id));
    const buttons = tabButtons();
    buttons[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(emitted).toEqual(['c']);
  });

  it('Home and End jump to the first/last tab', () => {
    const emitted: string[] = [];
    fixture.componentInstance.activeIdChange.subscribe((id: string) => emitted.push(id));
    const buttons = tabButtons();
    buttons[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    expect(emitted).toEqual(['c']);
    emitted.length = 0;
    buttons[0].nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    expect(emitted).toEqual([]);
  });

  // DaisyUI's `.tab` is `inline-flex; flex-wrap: wrap`, so in a narrow tab strip a squeezed button
  // wraps its icon onto a line above the label. Layout can't be measured in jsdom, so these pin
  // the classes that keep icon and label on a single row (icon always to the left of the text).
  describe('icon + label layout when the strip is narrow', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('tabs', [
        { id: 'a', label: 'Pinyes', icon: Shapes },
        { id: 'b', label: 'Troncs' },
      ]);
      fixture.detectChanges();
    });

    it('never wraps the icon onto its own line', () => {
      for (const button of tabButtons()) {
        expect(button.nativeElement.classList).toContain('flex-nowrap');
      }
    });

    it('keeps the label on one line', () => {
      for (const button of tabButtons()) {
        expect(button.nativeElement.classList).toContain('whitespace-nowrap');
      }
    });

    it('renders the icon before the label and never lets it shrink', () => {
      const button = tabButtons()[0].nativeElement as HTMLElement;
      const icon = button.querySelector('lucide-icon') as HTMLElement;

      expect(button.firstElementChild).toBe(icon);
      expect(icon.classList).toContain('shrink-0');
    });
  });

  // Below `sm` an inactive tab with an icon shrinks to just its icon so the strip fits without a
  // horizontal scrollbar. The label is `sr-only` (not display:none), so it stays the accessible
  // name. On by default; `[collapseInactive]="false"` opts out.
  describe('collapsing inactive tabs to their icon on phones', () => {
    const ICON_TABS: TabDef[] = [
      { id: 'a', label: 'Pinyes', icon: Shapes },
      { id: 'b', label: 'Troncs', icon: Shapes },
      { id: 'c', label: 'Sense icona' },
    ];
    const label = (i: number) =>
      tabButtons()[i].nativeElement.querySelector('span') as HTMLElement;

    beforeEach(() => {
      fixture.componentRef.setInput('tabs', ICON_TABS);
      fixture.detectChanges();
    });

    it('collapses the label of inactive tabs that have an icon', () => {
      expect(label(1).classList).toContain('max-sm:sr-only');
    });

    it('keeps the label of the active tab visible', () => {
      expect(label(0).classList).not.toContain('max-sm:sr-only');
    });

    it('moves the collapse when the active tab changes', () => {
      fixture.componentRef.setInput('activeId', 'b');
      fixture.detectChanges();

      expect(label(0).classList).toContain('max-sm:sr-only');
      expect(label(1).classList).not.toContain('max-sm:sr-only');
    });

    it('never collapses a tab that has no icon (it would become an empty button)', () => {
      expect(label(2).classList).not.toContain('max-sm:sr-only');
    });

    it('keeps the collapsed label in the DOM as the accessible name', () => {
      expect(tabButtons()[1].nativeElement.textContent).toContain('Troncs');
    });

    it('can be switched off per usage', () => {
      fixture.componentRef.setInput('collapseInactive', false);
      fixture.detectChanges();

      expect(label(1).classList).not.toContain('max-sm:sr-only');
    });
  });
});
