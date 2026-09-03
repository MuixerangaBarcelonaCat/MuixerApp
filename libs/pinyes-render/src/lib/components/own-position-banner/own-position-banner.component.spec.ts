import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OWN_POSITION_MULTIPLE_PLACEMENTS, OWN_POSITION_NO_PLACEMENT, OwnPositionSubject } from '@muixer/shared';
import { OwnPositionBannerComponent, OwnPositionBannerState } from './own-position-banner.component';

describe('OwnPositionBannerComponent', () => {
  let fixture: ComponentFixture<OwnPositionBannerComponent>;

  const setState = (state: OwnPositionBannerState) => {
    fixture.componentRef.setInput('state', state);
    fixture.detectChanges();
  };
  const setSubject = (subject: OwnPositionSubject) => {
    fixture.componentRef.setInput('subject', subject);
    fixture.detectChanges();
  };
  const backButton = () =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Torna a la teua posició"]');

  /** The sentence itself, excluding the Troba'm button which sits alongside it via flex gap. */
  const sentence = () =>
    (fixture.nativeElement as HTMLElement).querySelector('p > span')!.textContent!.replace(/\s+/g, ' ').trim();
  /** Text of the paragraph's leading span — the sentence, excluding any action/back button. */
  const paragraph = () => (fixture.nativeElement as HTMLElement).querySelector('p > span')!.textContent!.trim();
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

  describe('looking up another person', () => {
    it('renders the third-person sentence and swaps the action label to «On està»', () => {
      setState({ kind: 'PINYA', instanceIndex: 0, nodeLabel: 'Lateral', cordon: null, figureName: null, behind: null });
      setSubject({ kind: 'other', alias: 'Marta' });

      expect(sentence()).toBe('Marta és Lateral.');
      expect(buttonText()).toBe('On està');
    });

    it('names the other person in the NONE state', () => {
      setState({ kind: 'NONE' });
      setSubject({ kind: 'other', alias: 'Marta' });

      expect(paragraph()).toBe('Marta no ix en este segment.');
    });

    it('names the other person in the MULTIPLE state', () => {
      setState({ kind: 'MULTIPLE' });
      setSubject({ kind: 'other', alias: 'Marta' });

      expect(paragraph()).toBe("Marta està en més d'un lloc alhora. Parleu amb la tècnica.");
    });

    it('shows a back-to-me button in every state', () => {
      setState({ kind: 'NONE' });
      setSubject({ kind: 'other', alias: 'Marta' });
      expect(backButton()).not.toBeNull();

      setState({ kind: 'PINYA', instanceIndex: 0, nodeLabel: 'Lateral', cordon: null, figureName: null, behind: null });
      expect(backButton()).not.toBeNull();
    });

    it('emits back when the back-to-me button is clicked', () => {
      setState({ kind: 'NONE' });
      setSubject({ kind: 'other', alias: 'Marta' });
      const spy = jest.fn();
      fixture.componentInstance.back.subscribe(spy);

      backButton()!.click();

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  it('shows no back-to-me button when the subject is the caller themselves', () => {
    setState({ kind: 'NONE' });

    expect(backButton()).toBeNull();
  });
});
