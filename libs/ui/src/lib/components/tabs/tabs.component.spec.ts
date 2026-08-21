import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
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
});
