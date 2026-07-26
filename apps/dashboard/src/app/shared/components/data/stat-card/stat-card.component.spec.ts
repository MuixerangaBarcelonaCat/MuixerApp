import { ComponentFixture, TestBed } from '@angular/core/testing';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<StatCardComponent>;
  let component: StatCardComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
      providers: [
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatCardComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Adults');
    fixture.componentRef.setInput('value', 42);
    fixture.componentRef.setInput('icon', 'Users');
    fixture.detectChanges();
  });

  it('renders label and value', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.stat-title')?.textContent).toContain('Adults');
    expect(el.querySelector('.stat-value')?.textContent).toContain('42');
  });

  it('hides description when empty', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.stat-desc')).toBeNull();
  });

  it('shows description when provided', () => {
    fixture.componentRef.setInput('description', 'confirmats');
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('.stat-desc')?.textContent).toContain('confirmats');
  });

  it('applies custom accent class', () => {
    fixture.componentRef.setInput('accentClass', 'text-success');
    fixture.detectChanges();
    const figure = fixture.nativeElement.querySelector('.stat-figure');
    expect(figure?.classList.contains('text-success')).toBe(true);
  });

  it('renders lucide-icon element', () => {
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon).toBeTruthy();
  });
});
