import { ComponentFixture, TestBed } from '@angular/core/testing';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { MoveBannerComponent } from './move-banner.component';

describe('MoveBannerComponent', () => {
  let fixture: ComponentFixture<MoveBannerComponent>;

  const root = () => fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
  const cancelButton = () => fixture.nativeElement.querySelector('button[aria-label="Cancel·la el moviment"]') as HTMLButtonElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MoveBannerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(MoveBannerComponent);
    fixture.componentRef.setInput('alias', 'Pepet');
    fixture.detectChanges();
  });

  it('says who is being moved', () => {
    expect(root().textContent).toContain("S'està movent");
    expect(root().textContent).toContain('Pepet');
  });

  it('is announced politely to screen readers without stealing focus', () => {
    expect(root().getAttribute('aria-live')).toBe('polite');
  });

  it('has a cross button to cancel the move', () => {
    expect(cancelButton()).toBeTruthy();
  });

  it('emits cancelled when the cross is pressed', () => {
    const spy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(spy);

    cancelButton().click();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('follows the alias input', () => {
    fixture.componentRef.setInput('alias', 'Maria');
    fixture.detectChanges();

    expect(root().textContent).toContain('Maria');
    expect(root().textContent).not.toContain('Pepet');
  });

  it('cuts a long alias with an ellipsis instead of growing past its container', () => {
    const name = root().querySelector('[data-testid="move-banner-alias"]') as HTMLElement;

    expect(name.classList).toContain('truncate');
    expect(root().classList).toContain('max-w-full');
  });
});
