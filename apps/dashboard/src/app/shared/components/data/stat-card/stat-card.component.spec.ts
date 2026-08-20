import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Users } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';
import { StatCardComponent } from './stat-card.component';

describe('StatCardComponent', () => {
  let fixture: ComponentFixture<StatCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StatCardComponent],
      providers: [
        allLucideIconsProvider,
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(StatCardComponent);
    fixture.componentRef.setInput('label', 'Adults');
    fixture.componentRef.setInput('value', 42);
    fixture.componentRef.setInput('icon', Users);
    fixture.detectChanges();
  });

  it('renders inside a lib-card', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('lib-card')).toBeTruthy();
  });

  it('renders label and value', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Adults');
    expect(text).toContain('42');
  });

  it('hides description when empty', () => {
    const text = fixture.nativeElement.textContent;
    expect(text).not.toContain('confirmats');
  });

  it('shows description when provided', () => {
    fixture.componentRef.setInput('description', 'confirmats');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('confirmats');
  });

  it('applies custom accent class to the icon wrapper', () => {
    fixture.componentRef.setInput('accentClass', 'text-success');
    fixture.detectChanges();
    const iconWrapper = fixture.nativeElement.querySelector('lucide-icon')?.parentElement;
    expect(iconWrapper?.classList.contains('text-success')).toBe(true);
  });

  it('renders lucide-icon element', () => {
    const icon = fixture.nativeElement.querySelector('lucide-icon');
    expect(icon).toBeTruthy();
  });
});
