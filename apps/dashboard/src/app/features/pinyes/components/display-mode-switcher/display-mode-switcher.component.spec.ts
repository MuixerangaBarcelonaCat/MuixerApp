import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DisplayMode } from '@muixer/pinyes-render';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { DisplayModeSwitcherComponent } from './display-mode-switcher.component';

describe('DisplayModeSwitcherComponent', () => {
  let fixture: ComponentFixture<DisplayModeSwitcherComponent>;

  const group = () => fixture.nativeElement.querySelector('[role="group"]') as HTMLElement;
  const buttons = () => Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DisplayModeSwitcherComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(DisplayModeSwitcherComponent);
    fixture.componentRef.setInput('mode', 'position');
    fixture.detectChanges();
  });

  it('is one named group of the four modes, in order', () => {
    expect(group().getAttribute('aria-label')).toBe('Mode de visualització');
    expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['Posició', 'Alçada', 'Assistència', 'Gènere']);
  });

  it('names the shortcut key of each mode in its tooltip', () => {
    expect(buttons().map((b) => b.getAttribute('title'))).toEqual([
      'Colors per posició (1)',
      'Colors per alçada (2)',
      'Colors per assistència (3)',
      'Colors per gènere (4)',
    ]);
  });

  it('marks the current mode as pressed', () => {
    fixture.componentRef.setInput('mode', 'gender');
    fixture.detectChanges();
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'false', 'true']);
  });

  it('asks for the mode clicked', () => {
    const changes: DisplayMode[] = [];
    fixture.componentInstance.modeChange.subscribe((m) => changes.push(m));
    buttons()[2].click();
    expect(changes).toEqual(['attendance']);
  });

  it('hides the labels below md, leaving the icons (the tooltip and aria-label still name them)', () => {
    const label = buttons()[1].querySelector('[data-testid="mode-label"]') as HTMLElement;
    expect(label.textContent?.trim()).toBe('Alçada');
    expect(label.classList).toContain('hidden');
    expect(label.classList).toContain('md:inline');
  });
});
