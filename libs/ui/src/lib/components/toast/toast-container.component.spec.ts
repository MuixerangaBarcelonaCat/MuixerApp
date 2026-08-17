import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { ToastService } from '../../services/toast.service';
import { ToastContainerComponent } from './toast-container.component';

describe('ToastContainerComponent', () => {
  let fixture: ComponentFixture<ToastContainerComponent>;
  let toastService: ToastService;

  const items = () => fixture.debugElement.queryAll(By.css('[data-testid="lib-toast-item"]'));
  const container = () => fixture.debugElement.query(By.css('[data-testid="lib-toast-container"]')).nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(ToastContainerComponent);
    toastService = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  it('renders no toast items when there are none', () => {
    expect(items().length).toBe(0);
  });

  it('has aria-live="polite" on the container for screen-reader announcements', () => {
    expect(container().getAttribute('aria-live')).toBe('polite');
  });

  it('renders one item per toast in the service', () => {
    toastService.success('Un');
    toastService.error('Dos');
    fixture.detectChanges();
    expect(items().length).toBe(2);
  });

  it('renders the toast message text', () => {
    toastService.success('Desat correctament.');
    fixture.detectChanges();
    expect(items()[0].nativeElement.textContent).toContain('Desat correctament.');
  });

  describe.each([
    ['success', 'alert-success'],
    ['error', 'alert-error'],
    ['warning', 'alert-warning'],
    ['info', 'alert-info'],
  ] as const)('%s toast', (type, alertClass) => {
    it(`gets the ${alertClass} class and an icon`, () => {
      toastService[type]('missatge');
      fixture.detectChanges();
      const item = items()[0].nativeElement;
      expect(item.classList).toContain(alertClass);
      expect(items()[0].query(By.css('lucide-icon'))).toBeTruthy();
    });
  });

  it('clicking dismiss removes the toast from the service and the DOM', () => {
    toastService.success('Un');
    fixture.detectChanges();

    const dismissButton = fixture.debugElement.query(By.css('[data-testid="lib-toast-dismiss"]'));
    dismissButton.nativeElement.click();
    fixture.detectChanges();

    expect(toastService.toasts().length).toBe(0);
    expect(items().length).toBe(0);
  });

  it('dismisses only the clicked toast when several are shown', () => {
    toastService.success('Un');
    toastService.error('Dos');
    fixture.detectChanges();

    const firstDismiss = fixture.debugElement.queryAll(By.css('[data-testid="lib-toast-dismiss"]'))[0];
    firstDismiss.nativeElement.click();
    fixture.detectChanges();

    expect(items().length).toBe(1);
    expect(items()[0].nativeElement.textContent).toContain('Dos');
  });
});
