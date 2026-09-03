import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { allLucideIconsProvider } from '../../../testing/lucide-test-provider';
import { ModalComponent } from './modal.component';

describe('ModalComponent', () => {
  let fixture: ComponentFixture<ModalComponent>;

  const dialogEl = (): HTMLDialogElement => fixture.debugElement.query(By.css('dialog')).nativeElement;
  const boxEl = () => fixture.debugElement.query(By.css('.modal-box')).nativeElement;
  // The close button is a lib-button (display:contents host) — querying the wrapper alone would
  // find a non-interactive node whose .click() doesn't reach the real inner <button>, so this
  // targets the actual native button that receives clicks.
  const closeButton = () => fixture.debugElement.query(By.css('[data-testid="lib-modal-close"] button'));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModalComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    fixture = TestBed.createComponent(ModalComponent);
    fixture.detectChanges();
  });

  it('does not open the native dialog when open is false (default)', () => {
    expect(dialogEl().open).toBe(false);
  });

  it('calls showModal (native dialog opens) when open becomes true', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(dialogEl().open).toBe(true);
  });

  it('closes the native dialog when open becomes false again', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    fixture.componentRef.setInput('open', false);
    fixture.detectChanges();
    expect(dialogEl().open).toBe(false);
  });

  it('renders no title element when title is not set', () => {
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h2')).toBeNull();
  });

  it('renders the title when set', () => {
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('title', 'Títol');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('h2').textContent).toContain('Títol');
  });

  describe('closed output — fires uniformly from the native close event', () => {
    it('emits closed when the native dialog fires its close event', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.closed.subscribe(spy);

      dialogEl().dispatchEvent(new Event('close'));

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('emits closed when the close button is clicked, and the dialog actually closes', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.closed.subscribe(spy);

      closeButton().nativeElement.click();
      fixture.detectChanges();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(dialogEl().open).toBe(false);
    });

    it('emits closed on a backdrop click when dismissible', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      const spy = jest.fn();
      fixture.componentInstance.closed.subscribe(spy);

      dialogEl().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(spy).toHaveBeenCalledTimes(1);
      expect(dialogEl().open).toBe(false);
    });

    it('does not close on a click on the modal box itself (only the backdrop)', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();

      boxEl().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

      expect(dialogEl().open).toBe(true);
    });
  });

  describe('dismissible = false — no backdrop close, Escape is blocked, no close button allowed', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('dismissible', false);
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
    });

    it('renders no close button by default', () => {
      expect(closeButton()).toBeNull();
    });

    it('does not close on backdrop click', () => {
      dialogEl().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(dialogEl().open).toBe(true);
    });

    it('prevents the default action of the native cancel event (blocks Escape-close)', () => {
      const event = new Event('cancel', { cancelable: true });
      dialogEl().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    });

    it('throws if showCloseButton is explicitly set to true', () => {
      fixture.componentRef.setInput('showCloseButton', true);
      expect(() => fixture.detectChanges()).toThrow();
    });
  });

  describe('dismissible = true (default) — close button on by default, Escape allowed', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
    });

    it('renders a close button by default', () => {
      expect(closeButton()).toBeTruthy();
    });

    it('does not prevent the default action of the native cancel event', () => {
      const event = new Event('cancel', { cancelable: true });
      dialogEl().dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    });

    it('allows explicitly disabling the close button while staying dismissible', () => {
      fixture.componentRef.setInput('showCloseButton', false);
      fixture.detectChanges();
      expect(closeButton()).toBeNull();
    });
  });

  describe('size', () => {
    it('defaults to the md size', () => {
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      expect(boxEl().classList).toContain('max-w-md');
    });

    it('applies the requested size class', () => {
      fixture.componentRef.setInput('open', true);
      fixture.componentRef.setInput('size', 'xs');
      fixture.detectChanges();
      expect(boxEl().classList).toContain('max-w-xs');
    });
  });
});

describe('ModalComponent — content projection', () => {
  @Component({
    imports: [ModalComponent],
    template: `<lib-modal [open]="true" title="Títol">
      <p>body content</p>
      <div modalFooter><button type="button">Confirma</button></div>
    </lib-modal>`,
  })
  class HostComponent {}

  it('renders projected body and footer content', async () => {
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [allLucideIconsProvider],
    }).compileComponents();
    const hostFixture = TestBed.createComponent(HostComponent);
    hostFixture.detectChanges();

    expect(hostFixture.nativeElement.querySelector('[data-testid="lib-modal-body"]').textContent).toContain(
      'body content',
    );
    expect(hostFixture.nativeElement.querySelector('[data-testid="lib-modal-footer"]').textContent).toContain(
      'Confirma',
    );
  });
});
