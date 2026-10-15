import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi, afterEach } from 'vitest';
import { SegmentConflict } from '@muixer/pinyes-render';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { SegmentConflictPillComponent } from './segment-conflict-pill.component';

const makeConflict = (overrides: Partial<SegmentConflict> = {}): SegmentConflict => ({
  personId: 'p1',
  personAlias: 'Pepet',
  kind: 'TRONC_PINYA',
  suggestedRemovalAssignmentIds: ['a2'],
  placements: [
    {
      assignmentId: 'a1',
      figureInstanceId: 'fi-1',
      figureName: 'Pilar de 4',
      nodeId: 'n1',
      nodeLabel: 'Baix',
      zone: 'TRONC',
      positionType: null,
      area: 'TRONC',
      z: null,
      renglaPosition: null,
      cordon: null,
    },
    {
      assignmentId: 'a2',
      figureInstanceId: 'fi-2',
      figureName: 'Torre de 7',
      nodeId: 'n2',
      nodeLabel: null,
      zone: 'PINYA',
      positionType: null,
      area: 'PINYA',
      z: null,
      renglaPosition: 2,
      cordon: 2,
    },
  ],
  ...overrides,
});

describe('SegmentConflictPillComponent', () => {
  let fixture: ComponentFixture<SegmentConflictPillComponent>;
  let el: HTMLElement;

  const trigger = () => el.querySelector('[data-testid="segment-conflict-pill"]') as HTMLElement;
  const popover = () => el.querySelector('[data-testid="segment-conflict-popover"]') as HTMLElement | null;

  const render = (conflicts: SegmentConflict[]) => {
    fixture.componentRef.setInput('conflicts', conflicts);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SegmentConflictPillComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(SegmentConflictPillComponent);
    el = fixture.nativeElement;
  });

  it('labels a single conflict in the singular', () => {
    render([makeConflict()]);
    expect(trigger().textContent).toContain('1 conflicte');
    expect(trigger().textContent).not.toContain('conflictes');
  });

  it('labels several conflicts in the plural', () => {
    render([makeConflict(), makeConflict({ personId: 'p2', personAlias: 'Maria' })]);
    expect(trigger().textContent).toContain('2 conflictes');
  });

  it('hides the conflict list until the pill is hovered', () => {
    render([makeConflict()]);
    expect(popover()).toBeNull();
  });

  it('lists each person with every placement on hover', () => {
    render([makeConflict()]);

    trigger().dispatchEvent(new MouseEvent('mouseenter'));
    fixture.detectChanges();

    const text = popover()?.textContent ?? '';
    expect(text).toContain('Pepet');
    expect(text).toContain('Tronc');
    expect(text).toContain('Pilar de 4 · Baix');
    expect(text).toContain('Pinya');
    expect(text).toContain('Torre de 7');
    expect(text).not.toContain('Torre de 7 ·');
  });

  describe('pointer leaving', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    const hover = () => {
      trigger().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
    };

    it('closes the list shortly after the pointer leaves the pill', () => {
      render([makeConflict()]);
      hover();

      trigger().dispatchEvent(new MouseEvent('mouseleave'));
      vi.runAllTimers();
      fixture.detectChanges();

      expect(popover()).toBeNull();
    });

    it('keeps the list open while the pointer moves onto it, so a long list can scroll', () => {
      render([makeConflict()]);
      hover();

      trigger().dispatchEvent(new MouseEvent('mouseleave'));
      popover()!.dispatchEvent(new MouseEvent('mouseenter'));
      vi.runAllTimers();
      fixture.detectChanges();
      expect(popover()).not.toBeNull();

      popover()!.dispatchEvent(new MouseEvent('mouseleave'));
      vi.runAllTimers();
      fixture.detectChanges();
      expect(popover()).toBeNull();
    });
  });

  it('opens on keyboard focus and closes on Escape', () => {
    render([makeConflict()]);

    trigger().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();
    expect(popover()).not.toBeNull();

    trigger().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(popover()).toBeNull();
  });

  describe('scrolling', () => {
    const open = () => {
      render([makeConflict()]);
      trigger().dispatchEvent(new MouseEvent('mouseenter'));
      fixture.detectChanges();
    };

    it('closes the list when the page scrolls, since its fixed position would detach from the pill', () => {
      open();
      const scroller = document.createElement('div');
      document.body.appendChild(scroller);

      scroller.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      expect(popover()).toBeNull();
      scroller.remove();
    });

    it('stays open while the list itself scrolls', () => {
      open();

      popover()!.dispatchEvent(new Event('scroll'));
      fixture.detectChanges();

      expect(popover()).not.toBeNull();
    });
  });

  it('describes the pill by the open conflict list for assistive tech', () => {
    render([makeConflict()]);
    trigger().dispatchEvent(new FocusEvent('focus'));
    fixture.detectChanges();

    expect(trigger().getAttribute('aria-describedby')).toBe(popover()?.id);
  });

  it('renders nothing when there are no conflicts', () => {
    render([]);
    expect(trigger()).toBeNull();
  });
});
