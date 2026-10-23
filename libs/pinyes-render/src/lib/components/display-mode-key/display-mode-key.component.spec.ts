import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Provider, signal } from '@angular/core';
import { DEFAULT_COLLA_SETTINGS, Gender } from '@muixer/shared';
import { PINYES_RENDER_SETTINGS } from '../../settings/render-settings';
import { ATTENDANCE_TONES, GENDER_TONES, NODE_TYPE_PALETTE, heightRampTones } from '@muixer/ui';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { DisplayFacts } from '../../node-render/display-mode';
import { NODE_NAME_MEASURE } from '../node-drawing/node-drawing.component';
import { NodeLegendComponent } from '../node-legend/node-legend.component';
import { DisplayModeKeyComponent } from './display-mode-key.component';

const facts = (overrides: Partial<DisplayFacts> = {}): DisplayFacts => ({
  shoulderHeight: 150,
  gender: Gender.FEMALE,
  attendance: 'ANIRE',
  nextActuacio: false,
  ...overrides,
});

describe('DisplayModeKeyComponent', () => {
  function setup(inputs: Record<string, unknown>, providers: Provider[] = []) {
    TestBed.configureTestingModule({
      imports: [DisplayModeKeyComponent],
      providers: [allLucideIconsProvider, { provide: NODE_NAME_MEASURE, useValue: (t: string, fs: number) => t.length * fs * 0.6 }, ...providers],
    });
    const fixture = TestBed.createComponent(DisplayModeKeyComponent);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = () => Array.from(el.querySelectorAll('[data-testid="key-row"]')) as HTMLElement[];
    const swatchesIn = (row: HTMLElement) => Array.from(row.querySelectorAll('[data-testid="key-swatch"]')) as HTMLElement[];
    const toggle = () => el.querySelector('[data-testid="key-toggle"] button') as HTMLButtonElement;
    return { fixture, el, rows, swatchesIn, toggle };
  }

  it('heads the key with the mode and lists each row with its count', () => {
    const { el, rows } = setup({
      mode: 'gender',
      people: [facts({ gender: Gender.FEMALE }), facts({ gender: Gender.FEMALE }), facts({ gender: Gender.MALE })],
    });
    expect(el.querySelector('[data-testid="key-title"]')?.textContent?.trim()).toBe('Gènere');
    expect(rows().map((r) => r.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Dona: 2', 'Home: 1']);
  });

  it('shows each color as a plain square in its wash, edged in its pencil, not as a whole node', () => {
    const { el, rows, swatchesIn } = setup({ mode: 'gender', people: [facts({ gender: Gender.MALE })] });
    const [swatch] = swatchesIn(rows()[0]);
    expect(swatch.dataset['wash']).toBe(GENDER_TONES.male.wash);
    expect(swatch.dataset['pencil']).toBe(GENDER_TONES.male.pencil);
    expect(el.querySelector('app-node-drawing')).toBeNull();
  });

  it('draws each square with the canvas pen (rough.js): a wash fill and a pencil outline, with a wobble of its own', () => {
    const { rows, swatchesIn } = setup({ mode: 'gender', people: [facts({ gender: Gender.FEMALE }), facts({ gender: Gender.MALE })] });
    const pathsOf = (swatch: HTMLElement) => Array.from(swatch.querySelectorAll('svg path[data-role]')) as SVGPathElement[];
    const [female] = swatchesIn(rows()[0]);
    const fill = pathsOf(female).find((p) => p.dataset['role'] === 'fill')!;
    const outline = pathsOf(female).find((p) => p.dataset['role'] === 'outline')!;
    expect(fill.getAttribute('fill')).toBe(GENDER_TONES.female.wash);
    expect(outline.getAttribute('stroke')).toBe(GENDER_TONES.female.pencil);
    const [male] = swatchesIn(rows()[1]);
    const outlineOf = (swatch: HTMLElement) => pathsOf(swatch).find((p) => p.dataset['role'] === 'outline')!.getAttribute('d');
    expect(outlineOf(male)).not.toBe(outlineOf(female));
  });

  it('puts the star on the darker attendance square, as the canvas puts it on the darker node', () => {
    const { rows, swatchesIn } = setup({
      mode: 'attendance',
      people: [facts({ attendance: 'ANIRE' }), facts({ attendance: 'ANIRE', nextActuacio: true })],
    });
    const [base, strong] = swatchesIn(rows()[0]);
    expect(base.dataset['wash']).toBe(ATTENDANCE_TONES.success.base.wash);
    expect(base.querySelector('[data-testid="key-star"]')).toBeNull();
    expect(strong.dataset['wash']).toBe(ATTENDANCE_TONES.success.strong.wash);
    expect(strong.querySelector('[data-testid="key-star"]')).not.toBeNull();
  });

  it('notes who comes to the next actuació in a smaller line, the star where the squares go (last in the card)', () => {
    const { el, rows } = setup({ mode: 'attendance', people: [facts({ nextActuacio: true }), facts()] });
    const note = el.querySelector('[data-testid="key-note"]') as HTMLElement;
    expect(note.textContent?.replace(/\s+/g, ' ').trim()).toBe('Ve a la propera actuació: 1');
    expect(note.classList).toContain('text-xs');
    // Angular drops a whitespace-only gap between elements: the number keeps its distance by margin.
    expect(note.querySelector('[data-testid="key-note-count"]')!.classList).toContain('ml-1');
    expect(note.querySelector('[data-testid="key-swatch"]')).toBeNull();
    // As wide as a row's two squares, the star at its end: right under the darker, starred square.
    const slot = note.lastElementChild as HTMLElement;
    expect(slot.querySelector('[data-testid="key-note-star"]')).not.toBeNull();
    expect(slot.classList).toContain('w-9');
    expect(slot.classList).toContain('justify-end');
    expect(rows().some((r) => r.textContent?.includes('propera actuació'))).toBe(false);
  });

  it('in line, leads the note with the star, as the squares lead the rows', () => {
    const { el } = setup({ mode: 'attendance', layout: 'inline', people: [facts({ nextActuacio: true })] });
    const note = el.querySelector('[data-testid="key-note"]') as HTMLElement;
    expect(note.firstElementChild!.querySelector('[data-testid="key-note-star"]')).not.toBeNull();
  });

  it('draws the height bar with the canvas pen: the ramp\'s washes fill it, its pencils outline it', () => {
    const { el } = setup({ mode: 'height', people: [facts({ shoulderHeight: 143 })], heightDomain: { heights: [143, 172] } });
    const bar = el.querySelector('[data-testid="key-gradient"]') as HTMLElement;
    const fill = bar.querySelector('path[data-role="fill"]')!;
    const outline = bar.querySelector('path[data-role="outline"]')!;
    const gradientOf = (ref: string | null) => bar.querySelector(`linearGradient#${ref!.slice(5, -1)}`)!;
    const stops = (ref: string | null) => Array.from(gradientOf(ref).querySelectorAll('stop')).map((s) => s.getAttribute('stop-color'));
    expect(stops(fill.getAttribute('fill'))[0]).toBe(heightRampTones(0, 'light').wash);
    expect(stops(fill.getAttribute('fill')).at(-1)).toBe(heightRampTones(1, 'light').wash);
    expect(stops(outline.getAttribute('stroke')).at(-1)).toBe(heightRampTones(1, 'light').pencil);
  });

  it('in Posició lists the types drawn, without counts', () => {
    const { rows, swatchesIn } = setup({ mode: 'position', positionTypes: ['vents', 'agulla'] });
    expect(rows().map((r) => r.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['Agulla', 'Vent']);
    expect(swatchesIn(rows()[1])[0].dataset['wash']).toBe(NODE_TYPE_PALETTE['vents'].wash);
  });

  it('as a card (over the pinya), aligns the rows right with the square on the right; in line, the square leads', () => {
    const card = setup({ mode: 'gender', people: [facts()] });
    const cardRow = card.rows()[0];
    expect(cardRow.classList).toContain('justify-end');
    expect(cardRow.lastElementChild!.querySelector('[data-testid="key-swatch"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const inline = setup({ mode: 'gender', people: [facts()], layout: 'inline' });
    expect(inline.rows()[0].firstElementChild!.querySelector('[data-testid="key-swatch"]')).not.toBeNull();
  });

  it('marks the height bar at each quarter of the ranks in the height mode, the unit only after the last, and «Sense alçada» when someone has none', () => {
    const { el, fixture } = setup({
      mode: 'height',
      people: [facts({ shoulderHeight: 143 }), facts({ shoulderHeight: null })],
      heightDomain: { heights: [143, 150, 152, 160, 172] },
    });
    const ticks = () => Array.from(el.querySelectorAll('[data-testid="gradient-tick"]')).map((e) => e.textContent?.trim());
    expect(el.querySelector('[data-testid="key-gradient"]')).not.toBeNull();
    expect(ticks()).toEqual(['+3', '+10', '+12', '+20', '+32 cm']);
    expect(el.textContent).toContain('Sense alçada');

    fixture.componentRef.setInput('heightMode', 'absolute');
    fixture.detectChanges();
    expect(ticks()).toEqual(['143', '150', '152', '160', '172 cm']);
  });

  it("measures the relative marks from the colla's baseline", () => {
    const settings = signal({ shoulderHeightBaselineCm: 150, troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds });
    const { el } = setup(
      { mode: 'height', people: [facts({ shoulderHeight: 150 })], heightDomain: { heights: [150, 160] } },
      [{ provide: PINYES_RENDER_SETTINGS, useValue: settings }],
    );
    const ticks = Array.from(el.querySelectorAll('[data-testid="gradient-tick"]')).map((e) => e.textContent?.trim());
    expect(ticks[0]).toBe('+0');
    expect(ticks[ticks.length - 1]).toBe('+10 cm');
  });

  it('centers the one mark of a tab where everyone has the same height', () => {
    const { el } = setup({ mode: 'height', people: [facts({ shoulderHeight: 150 })], heightDomain: { heights: [150] }, heightMode: 'absolute' });
    const ticks = Array.from(el.querySelectorAll('[data-testid="gradient-tick"]'));
    expect(ticks.map((e) => e.textContent?.trim())).toEqual(['150 cm']);
    expect(ticks[0].parentElement!.classList).toContain('justify-center');
  });

  it('says so when no one is assigned yet', () => {
    const { el, rows } = setup({ mode: 'attendance', people: [] });
    expect(rows()).toEqual([]);
    expect(el.textContent).toContain('Encara no hi ha cap persona assignada.');
  });

  it('folds away to its heading, keeping the «Altres marques» button at hand', () => {
    const { fixture, el, rows, toggle } = setup({ mode: 'gender', people: [facts()] });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    expect(toggle().getAttribute('aria-label')).toBe('Amaga el significat dels colors');

    toggle().click();
    fixture.detectChanges();
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    expect(toggle().getAttribute('aria-label')).toBe('Mostra el significat dels colors');
    expect(rows()).toEqual([]);
    expect(el.querySelector('app-node-legend')).not.toBeNull();
  });

  it('hosts the «Altres marques» popover, told the mode, the phase and the palette', () => {
    const { fixture } = setup({ mode: 'attendance', people: [facts()], phase: 'day', legendPalette: 'neutral' });
    const legend = fixture.debugElement.query(By.directive(NodeLegendComponent)).componentInstance as NodeLegendComponent;
    expect(legend.displayMode()).toBe('attendance');
    expect(legend.phase()).toBe('day');
    expect(legend.palette()).toBe('neutral');
  });

  it('lays out as a floating card by default, or in a line for a toolbar strip', () => {
    const card = setup({ mode: 'gender', people: [facts()] });
    expect(card.el.querySelector('[data-layout="card"]')).not.toBeNull();
    TestBed.resetTestingModule();
    const inline = setup({ mode: 'gender', people: [facts()], layout: 'inline' });
    expect(inline.el.querySelector('[data-layout="inline"]')).not.toBeNull();
  });
});
