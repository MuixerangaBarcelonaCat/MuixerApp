import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PillBadgeComponent } from './pill-badge.component';

describe('PillBadgeComponent', () => {
  let fixture: ComponentFixture<PillBadgeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PillBadgeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PillBadgeComponent);
  });

  it('renders the label', () => {
    fixture.componentRef.setInput('label', '1 delegació');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('1 delegació');
  });

  it('emits clicked when clicked', () => {
    fixture.componentRef.setInput('label', '1 delegació');
    fixture.detectChanges();

    let clicked = false;
    fixture.componentInstance.clicked.subscribe(() => (clicked = true));

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(clicked).toBe(true);
  });

  it('renders as a native button, so it is keyboard-activatable without extra handlers', () => {
    fixture.componentRef.setInput('label', '1 delegació');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('button')).toBeTruthy();
  });
});
