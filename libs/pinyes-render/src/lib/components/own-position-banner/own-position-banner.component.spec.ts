import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OWN_POSITION_MULTIPLE_PLACEMENTS, OWN_POSITION_NO_PLACEMENT } from '@muixer/shared';
import { OwnPositionBannerComponent, OwnPositionBannerState } from './own-position-banner.component';

describe('OwnPositionBannerComponent', () => {
  let fixture: ComponentFixture<OwnPositionBannerComponent>;

  const setState = (state: OwnPositionBannerState) => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };

  /** The sentence itself, excluding the Troba'm button which sits alongside it via flex gap. */
  const sentence = () =>
    (fixture.nativeElement as HTMLElement).querySelector('p > span')!.textContent!.replace(/\s+/g, ' ').trim();
  /** Plain text of the whole paragraph — used for the MULTIPLE/NONE states, which have no button. */
  const paragraph = () => (fixture.nativeElement as HTMLElement).querySelector('p')!.textContent!.trim();
  const buttonText = () => (fixture.nativeElement as HTMLElement).querySelector('button')?.textContent?.trim();
  const uppercaseTexts = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.uppercase')).map((el) => el.textContent);
  const boldTexts = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('.font-bold')).map((el) => el.textContent);

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [OwnPositionBannerComponent] }).compileComponents();
    fixture = TestBed.createComponent(OwnPositionBannerComponent);
  });

  it('renders a PINYA placement with every clause', () => {
    setState({
      kind: 'PINYA',
      instanceIndex: 0,
      nodeLabel: 'Lateral',
      cordon: 2,
      figureName: 'Roscana',
      behind: 'Marta',
    });

    expect(sentence()).toBe('Sou Lateral (cordó 2) a Roscana, darrere de Marta.');
    expect(buttonText()).toBe("Troba'm");
    // The label and the alias are visually uppercased by CSS, never in the underlying data.
    expect(uppercaseTexts()).toEqual(['Lateral', 'Marta']);
    // The figure name is bold in addition to its palette colour — colour alone doesn't stand out
    // enough against the label/alias, which are already bold.
    expect(boldTexts()).toEqual(['Lateral', 'Roscana', 'Marta']);
  });

  it('renders a PINYA placement with every optional clause omitted', () => {
    setState({ kind: 'PINYA', instanceIndex: 0, nodeLabel: 'Lateral', cordon: null, figureName: null, behind: null });

    expect(sentence()).toBe('Sou Lateral.');
    expect(buttonText()).toBe("Troba'm");
  });

  it('renders a TRONC placement with both neighbour halves', () => {
    setState({
      kind: 'TRONC',
      instanceIndex: 1,
      nodeLabel: 'Segons',
      figureName: 'Roscana',
      below: ['Joan', 'Pere'],
      above: ['Marta'],
    });

    expect(sentence()).toBe('Sou Segons a Roscana, damunt de Joan i Pere, davall de Marta.');
  });

  it('renders the multiple-placements warning, in red, with no Troba\'m button', () => {
    setState({ kind: 'MULTIPLE' });

    expect(paragraph()).toBe(OWN_POSITION_MULTIPLE_PLACEMENTS);
    expect((fixture.nativeElement as HTMLElement).classList.contains('text-error')).toBe(true);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('renders the not-assigned line, with no Troba\'m button', () => {
    setState({ kind: 'NONE' });

    expect(paragraph()).toBe(OWN_POSITION_NO_PLACEMENT);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it("emits troba when the Troba'm button is clicked", () => {
    setState({ kind: 'PINYA', instanceIndex: 0, nodeLabel: 'Lateral', cordon: null, figureName: null, behind: null });
    const spy = jest.fn();
    fixture.componentInstance.troba.subscribe(spy);

    fixture.nativeElement.querySelector('button').click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
