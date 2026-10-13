import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DEFAULT_COLLA_SETTINGS, FigureZone, Gender } from '@muixer/shared';
import { PINYES_RENDER_SETTINGS } from '../../settings/render-settings';
import { ATTENDANCE_TONES, GENDER_TONES, ThemeService } from '@muixer/ui';
import { paperGrain } from '../../theme/paper-grain';
import { AssignmentDetail } from '../../models/assignment.model';
import { NodeAppearanceInput } from '../../node-render/appearance';
import { CanvasNode, FigureCanvasComponent } from './figure-canvas.component';

describe('FigureCanvasComponent', () => {
  // The Konva stage needs a real canvas (absent in jsdom) — only the host is under test here.
  function render() {
    TestBed.overrideComponent(FigureCanvasComponent, { set: { template: '' } });
    jest.spyOn(FigureCanvasComponent.prototype, 'ngAfterViewInit').mockImplementation(() => undefined);
    jest.spyOn(FigureCanvasComponent.prototype, 'ngOnDestroy').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(FigureCanvasComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('follows the app theme instead of pinning the light one', () => {
    expect(render().nativeElement.hasAttribute('data-theme')).toBe(false);
  });

  it('lays the canvas on grained paper, the grain of the app theme', () => {
    const fixture = render();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('light'));
    try {
      TestBed.inject(ThemeService).setPreference('dark');
      fixture.detectChanges();
      expect(host.style.getPropertyValue('--paper-grain')).toBe(paperGrain('dark'));
    } finally {
      TestBed.inject(ThemeService).setPreference('system');
      localStorage.clear();
    }
  });

  describe('readonly look', () => {
    const node = { id: 'n1', label: 'Vent', zone: FigureZone.PINYA, positionType: 'vents', color: null, climbIndicator: null } as unknown as CanvasNode;
    const readonlyInput = (inputs: Record<string, unknown>) => {
      const fixture = render();
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      const component = fixture.componentInstance as unknown as { readonlyNodeInput(n: CanvasNode): NodeAppearanceInput };
      return component.readonlyNodeInput(node);
    };

    it('draws the nodes as the projection does by default', () => {
      expect(readonlyInput({ mode: 'readonly' }).mode).toBe('projection');
    });

    it('draws the nodes filled, as the template editor does, with the template look (the Rengles tab)', () => {
      expect(readonlyInput({ mode: 'readonly', readonlyLook: 'template' }).mode).toBe('template');
    });
  });

  describe('display modes (appearance input of a staffed node)', () => {
    const node = { id: 'n1', label: 'Vent', zone: FigureZone.PINYA, positionType: 'vents', color: null, climbIndicator: null } as unknown as CanvasNode;
    const assignment = {
      id: 'a1',
      figureInstanceId: 'fi1',
      node: { id: 'n1' },
      person: { id: 'p1', alias: 'Marta', name: 'Marta', firstSurname: 'Puig', shoulderHeight: 152, notes: null, notesEmoji: null },
    } as unknown as AssignmentDetail;

    function staffed(inputs: Record<string, unknown>) {
      const fixture = render();
      for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
      const component = fixture.componentInstance as unknown as {
        appearanceInput(n: CanvasNode, a: AssignmentDetail | null, mode: 'workspace'): NodeAppearanceInput;
      };
      return (a: AssignmentDetail | null) => component.appearanceInput(node, a, 'workspace');
    }

    it('adds nothing in Posició (the default)', () => {
      const input = staffed({ nextPerformanceMap: new Map([['p1', 'ANIRE']]) })(assignment);
      expect(input.tones).toBeUndefined();
      expect(input.fillPolicy).toBeUndefined();
      expect(input.palette).toBeUndefined();
      expect(input.person?.nextActuacio).toBe(true);
    });

    it('takes the gender from the roster details, and draws an empty node neutral', () => {
      const appearanceInput = staffed({
        displayMode: 'gender',
        personDetailsMap: new Map([['p1', { positions: [], isXicalla: false, notes: null, notesEmoji: null, gender: Gender.FEMALE }]]),
      });
      expect(appearanceInput(assignment).tones).toEqual(GENDER_TONES.female);
      expect(appearanceInput(null)).toMatchObject({ palette: 'neutral' });
    });

    it('in Assistència fills solid in the semantic shade and keeps the star, the badges and the observation', () => {
      const input = staffed({
        displayMode: 'attendance',
        attendanceMap: new Map([['p1', 'NO_VAIG']]),
        nextPerformanceMap: new Map([['p1', 'ANIRE']]),
      })(assignment);
      expect(input).toMatchObject({ tones: ATTENDANCE_TONES.error.strong, fillPolicy: 'solid', attendance: 'absent' });
      expect(input.person).toMatchObject({ nextActuacio: true, height: '+12' });
    });

    it("measures the relative height from the colla's baseline", () => {
      TestBed.configureTestingModule({
        providers: [
          {
            provide: PINYES_RENDER_SETTINGS,
            useValue: signal({ shoulderHeightBaselineCm: 150, troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds }),
          },
        ],
      });
      expect(staffed({})(assignment).person?.height).toBe('+2');
    });
  });
});
