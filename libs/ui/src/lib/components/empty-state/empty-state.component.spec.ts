import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Tags } from 'lucide-angular';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { EmptyStateComponent } from './empty-state.component';

describe('EmptyStateComponent', () => {
  let fixture: ComponentFixture<EmptyStateComponent>;

  const rootEl = () => fixture.debugElement.children[0].nativeElement;
  const iconEl = () => fixture.debugElement.query(By.css('lucide-icon'));
  const actionButton = () => fixture.debugElement.query(By.css('button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EmptyStateComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(EmptyStateComponent);
    fixture.componentRef.setInput('message', 'No hi ha res per mostrar');
    fixture.detectChanges();
  });

  it('renders no card/box wrapper — sits directly in the parent layout', () => {
    expect(rootEl().tagName).toBe('DIV');
    expect(rootEl().classList).not.toContain('card');
  });

  it('has role="status" for screen readers', () => {
    expect(rootEl().getAttribute('role')).toBe('status');
  });

  it('renders the message', () => {
    expect(fixture.nativeElement.textContent).toContain('No hi ha res per mostrar');
  });

  it('renders no icon by default', () => {
    expect(iconEl()).toBeNull();
  });

  it('renders the icon when set, marked aria-hidden', () => {
    fixture.componentRef.setInput('icon', Tags);
    fixture.detectChanges();
    expect(iconEl()).toBeTruthy();
    expect(iconEl().nativeElement.getAttribute('aria-hidden')).toBe('true');
  });

  it('renders no action button by default', () => {
    expect(actionButton()).toBeNull();
  });

  it('renders the action button when actionLabel is set', () => {
    fixture.componentRef.setInput('actionLabel', 'Neteja filtres');
    fixture.detectChanges();
    expect(actionButton().nativeElement.textContent).toContain('Neteja filtres');
  });

  it('emits clicked when the action button is clicked', () => {
    fixture.componentRef.setInput('actionLabel', 'Neteja filtres');
    fixture.detectChanges();
    const spy = jest.fn();
    fixture.componentInstance.clicked.subscribe(spy);

    actionButton().nativeElement.click();

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
