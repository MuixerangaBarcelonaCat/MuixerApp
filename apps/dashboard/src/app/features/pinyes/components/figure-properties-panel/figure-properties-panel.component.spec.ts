import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { describe, it, expect, beforeEach } from 'vitest';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { FigurePropertiesPanelComponent, FigurePropertiesEntry } from './figure-properties-panel.component';

const makeEntry = (overrides: Partial<FigurePropertiesEntry> = {}): FigurePropertiesEntry => ({
  id: 'entry-1',
  label: null,
  figureTemplateName: 'Pilar',
  figureMode: 'COMPLETA',
  numberOfCordons: null,
  maxCordons: 4,
  hasPinya: true,
  offsetX: 10,
  offsetY: 20,
  angle: 0,
  cordonsObertsEnabled: true,
  hasCordoObertNodes: false,
  ...overrides,
});

describe('FigurePropertiesPanelComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FigurePropertiesPanelComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
  });

  const create = (entry: FigurePropertiesEntry, showRemove = true) => {
    const fixture = TestBed.createComponent(FigurePropertiesPanelComponent);
    fixture.componentRef.setInput('entry', entry);
    fixture.componentRef.setInput('showRemove', showRemove);
    fixture.detectChanges();
    return fixture;
  };

  it('shows the template name as a placeholder when label is null', () => {
    const fixture = create(makeEntry({ label: null, figureTemplateName: 'Pilar' }));
    const input = fixture.debugElement.query(By.css('input[type="text"]')).nativeElement as HTMLInputElement;
    expect(input.placeholder).toBe('Pilar');
    expect(input.value).toBe('');
  });

  it('emits labelChanged with the entry id when the name input changes', () => {
    const fixture = create(makeEntry());
    let emitted: { id: string; value: string | null } | undefined;
    fixture.componentInstance.labelChanged.subscribe((e) => (emitted = e));

    fixture.componentInstance.onLabelChange('Pilar central');

    expect(emitted).toEqual({ id: 'entry-1', value: 'Pilar central' });
  });

  it('emits labelChanged with null when the name is cleared', () => {
    const fixture = create(makeEntry());
    let emitted: { id: string; value: string | null } | undefined;
    fixture.componentInstance.labelChanged.subscribe((e) => (emitted = e));

    fixture.componentInstance.onLabelChange('   ');

    expect(emitted).toEqual({ id: 'entry-1', value: null });
  });

  it('emits figureModeChanged with the entry id', () => {
    const fixture = create(makeEntry());
    let emitted: { id: string; value: string } | undefined;
    fixture.componentInstance.figureModeChanged.subscribe((e) => (emitted = e));

    fixture.componentInstance.onFigureModeChange('REMAT');

    expect(emitted).toEqual({ id: 'entry-1', value: 'REMAT' });
  });

  describe('mode switcher', () => {
    it('is hidden for figures whose template has no pinya (always neta)', () => {
      const fixture = create(makeEntry({ hasPinya: false }));
      expect(fixture.debugElement.query(By.css('[data-mode-option]'))).toBeFalsy();
    });

    it('is shown for figures whose template has a pinya', () => {
      const fixture = create(makeEntry({ hasPinya: true }));
      expect(fixture.debugElement.query(By.css('[data-mode-option]'))).toBeTruthy();
    });

    it('shows all four mode options as buttons', () => {
      const fixture = create(makeEntry());
      const buttons = fixture.debugElement.queryAll(By.css('[data-mode-option]'));
      expect(buttons.map((b) => b.attributes['data-mode-option'])).toEqual([
        'COMPLETA',
        'PEU',
        'REMAT',
        'NETA',
      ]);
    });

    it('marks the current mode as pressed', () => {
      const fixture = create(makeEntry({ figureMode: 'REMAT' }));
      const buttons = fixture.debugElement.queryAll(By.css('[data-mode-option]'));
      const pressed = buttons.filter((b) => b.attributes['aria-pressed'] === 'true');
      expect(pressed.map((b) => b.attributes['data-mode-option'])).toEqual(['REMAT']);
    });

    it('clicking an option emits figureModeChanged', () => {
      const fixture = create(makeEntry({ figureMode: 'COMPLETA' }));
      let emitted: { id: string; value: string } | undefined;
      fixture.componentInstance.figureModeChanged.subscribe((e) => (emitted = e));

      const petaButton = fixture.debugElement
        .queryAll(By.css('[data-mode-option]'))
        .find((b) => b.attributes['data-mode-option'] === 'PEU');
      petaButton?.nativeElement.click();

      expect(emitted).toEqual({ id: 'entry-1', value: 'PEU' });
    });
  });

  describe('cordons stepper', () => {
    it('shows "Tots" when numberOfCordons is null', () => {
      const fixture = create(makeEntry({ numberOfCordons: null, maxCordons: 4 }));
      expect(fixture.nativeElement.textContent).toContain('Tots');
    });

    it('shows "current/max" when numberOfCordons is set', () => {
      const fixture = create(makeEntry({ numberOfCordons: 2, maxCordons: 4 }));
      expect(fixture.nativeElement.textContent).toContain('2/4');
    });

    it('shows "Sense rengles" and no stepper buttons when maxCordons is 0', () => {
      const fixture = create(makeEntry({ maxCordons: 0 }));
      expect(fixture.nativeElement.textContent).toContain('Sense rengles');
      expect(fixture.debugElement.query(By.css('[aria-label="Augmenta els cordons"]'))).toBeFalsy();
    });

    it('increments 1 -> 2 -> 3 -> 4 -> Tots', () => {
      const fixture = create(makeEntry({ numberOfCordons: 3, maxCordons: 4 }));
      let emitted: { id: string; value: number | null } | undefined;
      fixture.componentInstance.numberOfCordonsChanged.subscribe((e) => (emitted = e));

      fixture.componentInstance.onCordonsIncrement();
      expect(emitted).toEqual({ id: 'entry-1', value: 4 });

      const atMax = create(makeEntry({ numberOfCordons: 4, maxCordons: 4 }));
      atMax.componentInstance.numberOfCordonsChanged.subscribe((e) => (emitted = e));
      atMax.componentInstance.onCordonsIncrement();
      expect(emitted).toEqual({ id: 'entry-1', value: null });
    });

    it('decrements Tots -> 4 -> 3 -> ... -> 1', () => {
      const fixture = create(makeEntry({ numberOfCordons: null, maxCordons: 4 }));
      let emitted: { id: string; value: number | null } | undefined;
      fixture.componentInstance.numberOfCordonsChanged.subscribe((e) => (emitted = e));

      fixture.componentInstance.onCordonsDecrement();
      expect(emitted).toEqual({ id: 'entry-1', value: 4 });

      emitted = undefined;
      const at1 = create(makeEntry({ numberOfCordons: 1, maxCordons: 4 }));
      at1.componentInstance.numberOfCordonsChanged.subscribe((e) => (emitted = e));
      at1.componentInstance.onCordonsDecrement();
      expect(emitted).toBeUndefined();
    });

    it('does not increment beyond Tots', () => {
      const fixture = create(makeEntry({ numberOfCordons: null, maxCordons: 4 }));
      let emitted: { id: string; value: number | null } | undefined;
      fixture.componentInstance.numberOfCordonsChanged.subscribe((e) => (emitted = e));

      fixture.componentInstance.onCordonsIncrement();

      expect(emitted).toBeUndefined();
    });
  });

  it('shows the cordons control only for COMPLETA and PEU modes', () => {
    const completa = create(makeEntry({ figureMode: 'COMPLETA' }));
    expect(completa.debugElement.query(By.css('[aria-label="Augmenta els cordons"]'))).toBeTruthy();

    const remat = create(makeEntry({ figureMode: 'REMAT' }));
    expect(remat.debugElement.query(By.css('[aria-label="Augmenta els cordons"]'))).toBeFalsy();
  });

  it('emits offsetXChanged/offsetYChanged/angleChanged with the entry id', () => {
    const fixture = create(makeEntry());
    let x: { id: string; value: number } | undefined;
    let y: { id: string; value: number } | undefined;
    let angle: { id: string; value: number } | undefined;
    fixture.componentInstance.offsetXChanged.subscribe((e) => (x = e));
    fixture.componentInstance.offsetYChanged.subscribe((e) => (y = e));
    fixture.componentInstance.angleChanged.subscribe((e) => (angle = e));

    fixture.componentInstance.onOffsetXChange('100');
    fixture.componentInstance.onOffsetYChange('200');
    fixture.componentInstance.onAngleChange('45');

    expect(x).toEqual({ id: 'entry-1', value: 100 });
    expect(y).toEqual({ id: 'entry-1', value: 200 });
    expect(angle).toEqual({ id: 'entry-1', value: 45 });
  });

  it('emits removeRequested with the entry id', () => {
    const fixture = create(makeEntry());
    let emitted: string | undefined;
    fixture.componentInstance.removeRequested.subscribe((id) => (emitted = id));

    fixture.componentInstance.onRemove();

    expect(emitted).toBe('entry-1');
  });

  describe('cordons oberts checkbox', () => {
    it('is hidden when the figure has no cordo-obert nodes', () => {
      const fixture = create(makeEntry({ hasCordoObertNodes: false }));
      expect(fixture.debugElement.query(By.css('[data-cordons-oberts-checkbox]'))).toBeFalsy();
    });

    it('is shown when the figure has cordo-obert nodes', () => {
      const fixture = create(makeEntry({ hasCordoObertNodes: true }));
      expect(fixture.debugElement.query(By.css('[data-cordons-oberts-checkbox]'))).toBeTruthy();
    });

    it('is checked when cordonsObertsEnabled is true', () => {
      const fixture = create(makeEntry({ hasCordoObertNodes: true, cordonsObertsEnabled: true }));
      const checkbox = fixture.debugElement.query(By.css('[data-cordons-oberts-checkbox]'))
        .nativeElement as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });

    it('is unchecked when cordonsObertsEnabled is false', () => {
      const fixture = create(makeEntry({ hasCordoObertNodes: true, cordonsObertsEnabled: false }));
      const checkbox = fixture.debugElement.query(By.css('[data-cordons-oberts-checkbox]'))
        .nativeElement as HTMLInputElement;
      expect(checkbox.checked).toBe(false);
    });

    it('emits cordonsObertsEnabledChanged with the entry id when toggled', () => {
      const fixture = create(makeEntry({ hasCordoObertNodes: true, cordonsObertsEnabled: true }));
      let emitted: { id: string; value: boolean } | undefined;
      fixture.componentInstance.cordonsObertsEnabledChanged.subscribe((e) => (emitted = e));

      fixture.componentInstance.onCordonsObertsEnabledChange(false);

      expect(emitted).toEqual({ id: 'entry-1', value: false });
    });
  });

  it('shows the remove button by default', () => {
    const fixture = create(makeEntry());
    expect(fixture.debugElement.query(By.css('button.btn-error'))).toBeTruthy();
  });

  it('hides the remove button when showRemove is false', () => {
    const fixture = create(makeEntry(), false);
    expect(fixture.debugElement.query(By.css('button.btn-error'))).toBeFalsy();
  });
});
