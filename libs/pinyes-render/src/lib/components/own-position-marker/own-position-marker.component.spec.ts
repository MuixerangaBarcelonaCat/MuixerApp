import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OwnPositionSubject } from '@muixer/shared';
import { StageTransform } from '../../utils/rengla-coordinates.util';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { MarkerTarget, OwnPositionMarkerComponent } from './own-position-marker.component';

const IDENTITY: StageTransform = { x: 0, y: 0, scaleX: 1, scaleY: 1 };
const VIEWPORT = { width: 400, height: 300 };

describe('OwnPositionMarkerComponent', () => {
  let fixture: ComponentFixture<OwnPositionMarkerComponent>;

  const setInputs = (overrides: {
    target?: MarkerTarget | null;
    stageTransform?: StageTransform;
    viewport?: { width: number; height: number };
    arrivedTick?: number;
    subject?: OwnPositionSubject;
  }) => {
    if ('target' in overrides) fixture.componentRef.setInput('target', overrides.target);
    if (overrides.stageTransform) fixture.componentRef.setInput('stageTransform', overrides.stageTransform);
    fixture.componentRef.setInput('viewport', overrides.viewport ?? VIEWPORT);
    if (overrides.arrivedTick !== undefined) fixture.componentRef.setInput('arrivedTick', overrides.arrivedTick);
    if (overrides.subject) fixture.componentRef.setInput('subject', overrides.subject);
    fixture.detectChanges();
  };

  const pinEl = () => fixture.debugElement.query(By.css('[data-testid="own-position-pin"]'));
  const chevronEl = () => fixture.debugElement.query(By.css('[data-testid="own-position-chevron"]'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OwnPositionMarkerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(OwnPositionMarkerComponent);
  });

  it('renders nothing when target is null', () => {
    setInputs({ target: null });
    expect(pinEl()).toBeNull();
    expect(chevronEl()).toBeNull();
  });

  describe('screen position — world target', () => {
    it('matches the world coordinates under an identity transform', () => {
      setInputs({ target: { kind: 'world', x: 100, y: 50 }, stageTransform: IDENTITY });
      expect(fixture.componentInstance.screenPosition()).toEqual({ x: 100, y: 50 });
    });

    it('applies pan and zoom from the stage transform', () => {
      setInputs({
        target: { kind: 'world', x: 100, y: 50 },
        stageTransform: { x: 20, y: 10, scaleX: 2, scaleY: 2 },
      });
      expect(fixture.componentInstance.screenPosition()).toEqual({ x: 220, y: 110 });
    });
  });

  describe('screen position — screen target (tronc panel)', () => {
    it('uses the coordinates as-is, ignoring the stage transform', () => {
      setInputs({
        target: { kind: 'screen', x: 150, y: 40 },
        stageTransform: { x: 999, y: 999, scaleX: 5, scaleY: 5 },
      });
      expect(fixture.componentInstance.screenPosition()).toEqual({ x: 150, y: 40 });
    });
  });

  describe('pin vs chevron', () => {
    it('shows the pin and hides the chevron when the target is within the viewport', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 } });
      expect(pinEl()).toBeTruthy();
      expect(chevronEl()).toBeNull();
    });

    it('shows the chevron and hides the pin when the target is outside the viewport', () => {
      setInputs({ target: { kind: 'screen', x: 500, y: 150 } });
      expect(pinEl()).toBeNull();
      expect(chevronEl()).toBeTruthy();
    });

    it('labels the chevron for the caller by default', () => {
      setInputs({ target: { kind: 'screen', x: 500, y: 150 } });
      expect(chevronEl().attributes['aria-label']).toBe('Ves a la teua posició');
    });

    it('labels the chevron with the alias when looking up someone else', () => {
      const other: OwnPositionSubject = { kind: 'other', alias: 'Marta' };
      setInputs({ target: { kind: 'screen', x: 500, y: 150 }, subject: other });
      expect(chevronEl().attributes['aria-label']).toBe('Ves a la posició de Marta');
    });

    it('elides the preposition before a vowel alias', () => {
      const other: OwnPositionSubject = { kind: 'other', alias: 'Anna' };
      setInputs({ target: { kind: 'screen', x: 500, y: 150 }, subject: other });
      expect(chevronEl().attributes['aria-label']).toBe("Ves a la posició d'Anna");
    });

    it('treats the exact viewport edges as inside', () => {
      setInputs({ target: { kind: 'screen', x: 0, y: 0 } });
      expect(pinEl()).toBeTruthy();
      setInputs({ target: { kind: 'screen', x: VIEWPORT.width, y: VIEWPORT.height } });
      expect(pinEl()).toBeTruthy();
    });
  });

  describe('chevron clamping', () => {
    // Viewport is 400×300, centre (200, 150). Margin is internal to the component.
    it('clamps to the right edge when the target is due right of centre', () => {
      setInputs({ target: { kind: 'screen', x: 1000, y: 150 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.y).toBeCloseTo(150, 5);
      expect(pos.x).toBeLessThan(VIEWPORT.width);
      expect(pos.x).toBeGreaterThan(VIEWPORT.width / 2);
      expect(fixture.componentInstance.chevronAngleDeg()).toBeCloseTo(0, 5);
    });

    it('clamps to the left edge when the target is due left of centre', () => {
      setInputs({ target: { kind: 'screen', x: -1000, y: 150 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.y).toBeCloseTo(150, 5);
      expect(pos.x).toBeLessThan(VIEWPORT.width / 2);
      expect(fixture.componentInstance.chevronAngleDeg()).toBeCloseTo(180, 5);
    });

    it('clamps to the top edge when the target is due above centre', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: -1000 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.x).toBeCloseTo(200, 5);
      expect(pos.y).toBeLessThan(VIEWPORT.height / 2);
      expect(fixture.componentInstance.chevronAngleDeg()).toBeCloseTo(-90, 5);
    });

    it('clamps to the bottom edge when the target is due below centre', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 1000 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.x).toBeCloseTo(200, 5);
      expect(pos.y).toBeGreaterThan(VIEWPORT.height / 2);
      expect(fixture.componentInstance.chevronAngleDeg()).toBeCloseTo(90, 5);
    });

    it('clamps toward a corner when the target is diagonally offscreen', () => {
      // Far past the bottom-right corner, at 45° from centre — viewport isn't square, so the
      // clamped point should still land inside both bounds, hugging whichever edge is nearer.
      setInputs({ target: { kind: 'screen', x: 200 + 1000, y: 150 + 1000 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.x).toBeLessThanOrEqual(VIEWPORT.width);
      expect(pos.y).toBeLessThanOrEqual(VIEWPORT.height);
      expect(fixture.componentInstance.chevronAngleDeg()).toBeCloseTo(45, 5);
    });

    it('keeps the chevron inset from the true edge, not flush against it', () => {
      setInputs({ target: { kind: 'screen', x: 1000, y: 150 } });
      const pos = fixture.componentInstance.chevronPosition()!;
      expect(pos.x).toBeLessThan(VIEWPORT.width - 4);
    });
  });

  describe('interaction', () => {
    it('emits troba when the chevron is clicked', () => {
      setInputs({ target: { kind: 'screen', x: 1000, y: 150 } });
      const spy = jest.fn();
      fixture.componentInstance.troba.subscribe(spy);

      chevronEl().nativeElement.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('the pin has no click handler', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 } });
      expect(pinEl().nativeElement.tagName).not.toBe('BUTTON');
    });
  });

  describe('arrival bounce', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('does not bounce on the very first tick it receives (page-load entry)', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 }, arrivedTick: 1 });
      expect(pinEl().nativeElement.className).not.toContain('animate-arrival-bounce');
    });

    it('bounces on every tick after the first', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 }, arrivedTick: 1 });
      setInputs({ arrivedTick: 2 });
      expect(pinEl().nativeElement.className).toContain('animate-arrival-bounce');
    });

    it('clears the bounce class again after the animation finishes', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 }, arrivedTick: 1 });
      setInputs({ arrivedTick: 2 });
      expect(pinEl().nativeElement.className).toContain('animate-arrival-bounce');

      jest.runAllTimers();
      fixture.detectChanges();

      expect(pinEl().nativeElement.className).not.toContain('animate-arrival-bounce');
    });

    it('does not bounce again for the same tick re-applied', () => {
      setInputs({ target: { kind: 'screen', x: 200, y: 150 }, arrivedTick: 1 });
      setInputs({ arrivedTick: 2 });
      jest.runAllTimers();
      fixture.detectChanges();

      setInputs({ arrivedTick: 2 });

      expect(pinEl().nativeElement.className).not.toContain('animate-arrival-bounce');
    });
  });

  describe('restless chevron', () => {
    it('carries the restless class whenever it is rendered — it only exists while off-viewport', () => {
      setInputs({ target: { kind: 'screen', x: 1000, y: 150 } });
      expect(chevronEl().nativeElement.className).toContain('animate-restless');
    });
  });
});
