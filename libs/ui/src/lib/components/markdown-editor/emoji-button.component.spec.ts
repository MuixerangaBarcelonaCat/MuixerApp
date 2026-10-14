import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { OverlayContainer } from '@angular/cdk/overlay';
import { EmojiButtonComponent } from './emoji-button.component';

describe('EmojiButtonComponent', () => {
  let fixture: ComponentFixture<EmojiButtonComponent>;
  let picked: string[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmojiButtonComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EmojiButtonComponent);
    picked = [];
    fixture.componentInstance.picked.subscribe((emoji) => picked.push(emoji));
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(OverlayContainer).ngOnDestroy();
  });

  const trigger = (): HTMLButtonElement =>
    fixture.debugElement.query(By.css('[data-testid="md-emoji"] button')).nativeElement;

  // The panel lives in the CDK's body-level container, not in this component's own subtree.
  const panel = (): HTMLElement | null => document.querySelector('[role="dialog"]');
  const pickerElement = (): HTMLElement => document.querySelector('emoji-picker')!;

  const openPanel = (): void => {
    trigger().click();
    fixture.detectChanges();
  };

  /** The library element emits a CustomEvent whose detail carries the chosen character. */
  const chooseEmoji = (unicode: string): void => {
    pickerElement().dispatchEvent(new CustomEvent('emoji-click', { detail: { unicode } }));
    fixture.detectChanges();
  };

  it('keeps the picker closed until the button is used', () => {
    expect(panel()).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('opens the library picker', () => {
    openPanel();

    expect(panel()).not.toBeNull();
    expect(pickerElement()).not.toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('true');
  });

  // The editor's own wrapper is `overflow-hidden` (it rounds the corners) and the app shell clips
  // to the viewport, so a panel rendered in place gets cut off whenever the editor is short.
  it('renders the panel outside its own subtree, where nothing can clip it', () => {
    openPanel();

    expect(fixture.nativeElement.contains(panel())).toBe(false);
    expect(document.querySelector('.cdk-overlay-container [role="dialog"]')).not.toBeNull();
  });

  it('emits the chosen emoji and closes', () => {
    openPanel();
    chooseEmoji('🎉');

    expect(picked).toEqual(['🎉']);
    expect(panel()).toBeNull();
  });

  it('ignores an event with no character in it', () => {
    openPanel();
    pickerElement().dispatchEvent(new CustomEvent('emoji-click', { detail: {} }));
    fixture.detectChanges();

    expect(picked).toEqual([]);
    expect(panel()).not.toBeNull();
  });

  it('closes when clicking outside', () => {
    openPanel();

    document.body.click();
    fixture.detectChanges();

    expect(panel()).toBeNull();
  });

  it('stays open when clicking inside the panel', () => {
    openPanel();

    panel()!.click();
    fixture.detectChanges();

    expect(panel()).not.toBeNull();
  });

  // The overlay's own outside-click would also fire for the trigger, so without care a second
  // click would close and immediately reopen. It must simply toggle shut.
  it('closes when the trigger is clicked again', () => {
    openPanel();
    expect(panel()).not.toBeNull();

    trigger().click();
    fixture.detectChanges();

    expect(panel()).toBeNull();
  });

  it('cannot be opened when disabled', () => {
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();

    expect(trigger().disabled).toBe(true);
    openPanel();
    expect(panel()).toBeNull();
  });
});
