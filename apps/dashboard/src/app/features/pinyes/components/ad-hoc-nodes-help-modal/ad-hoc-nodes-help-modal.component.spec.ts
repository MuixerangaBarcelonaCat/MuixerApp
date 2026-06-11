import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdHocNodesHelpModalComponent } from './ad-hoc-nodes-help-modal.component';

describe('AdHocNodesHelpModalComponent', () => {
  let fixture: ComponentFixture<AdHocNodesHelpModalComponent>;
  let component: AdHocNodesHelpModalComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdHocNodesHelpModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdHocNodesHelpModalComponent);
    component = fixture.componentInstance;
  });

  it('does not render dialog when open is false', () => {
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeNull();
  });

  it('renders dialog when open is true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeTruthy();
  });

  it('renders the help content', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nodes ad-hoc');
    expect(text).toContain('Com funciona?');
    expect(text).toContain('vora discontínua');
  });

  it('emits closed when Escape is pressed', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.closed.subscribe(spy);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(spy).toHaveBeenCalled();
  });

  it('emits closed when "Entès" button is clicked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.closed.subscribe(spy);
    const btn = fixture.nativeElement.querySelector('.btn-primary') as HTMLButtonElement;
    btn.click();
    expect(spy).toHaveBeenCalled();
  });

  it('emits closed when backdrop is clicked', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    const spy = vi.fn();
    component.closed.subscribe(spy);
    const backdrop = fixture.nativeElement.querySelector('.modal-backdrop') as HTMLButtonElement;
    backdrop.click();
    expect(spy).toHaveBeenCalled();
  });
});
