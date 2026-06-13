import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { CordonsDialogComponent, CordonsDialogSaveEvent } from './cordons-dialog.component';
import { RenglaModel } from '../../models/figure-template.model';

@Component({
  standalone: true,
  imports: [CordonsDialogComponent],
  template: `
    <app-cordons-dialog
      [open]="open()"
      [numberOfCordons]="numberOfCordons()"
      [openCordons]="openCordons()"
      [rengles]="rengles()"
      [maxCordons]="maxCordons()"
      (saved)="onSaved($event)"
      (closed)="onClosed()"
    />
  `,
})
class TestHostComponent {
  open = signal(true);
  numberOfCordons = signal<number | null>(null);
  openCordons = signal<string[]>([]);
  rengles = signal<RenglaModel[]>([
    { id: 'r1', name: 'Mans Nord', sortOrder: 0, allowsCordoObert: true },
    { id: 'r2', name: 'Vents Est', sortOrder: 1, allowsCordoObert: true },
  ]);
  maxCordons = signal(3);
  savedEvent: CordonsDialogSaveEvent | null = null;
  closedCalled = false;

  onSaved(event: CordonsDialogSaveEvent): void {
    this.savedEvent = event;
  }
  onClosed(): void {
    this.closedCalled = true;
  }
}

function findButton(fixture: ComponentFixture<TestHostComponent>, text: string): HTMLButtonElement | undefined {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.find((b) => b.textContent?.trim() === text);
}

function findButtonByLabel(fixture: ComponentFixture<TestHostComponent>, label: string): HTMLButtonElement | undefined {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('button'));
  return buttons.find((b) => b.getAttribute('aria-label') === label);
}

describe('CordonsDialogComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let host: TestHostComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the dialog when open is true', () => {
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeTruthy();
  });

  it('does not render the dialog when open is false', () => {
    host.open.set(false);
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog).toBeNull();
  });

  it('shows "Tots" when numberOfCordons is null', () => {
    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('Tots');
  });

  it('shows numeric value when numberOfCordons is set', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();
    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('increment button increases the cordon count', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButtonByLabel(fixture, 'Augmentar cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('3');
  });

  it('decrement button decreases the cordon count', () => {
    host.numberOfCordons.set(3);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButtonByLabel(fixture, 'Reduir cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('decrement from null sets to maxCordons - 1', () => {
    findButtonByLabel(fixture, 'Reduir cordons')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('2');
  });

  it('increment is disabled at maxCordons', () => {
    host.numberOfCordons.set(3);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    const btn = findButtonByLabel(fixture, 'Augmentar cordons');
    expect(btn?.disabled).toBe(true);
  });

  it('renders rengla toggles', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(2);
  });

  it('toggling a rengla checkbox updates openCordons', () => {
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    checkboxes[0].click();
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.openCordons).toContain('r1');
  });

  it('emits saved event with correct payload', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent).toEqual({
      numberOfCordons: 2,
      openCordons: [],
    });
  });

  it('emits closed event on cancel', () => {
    findButton(fixture, 'Cancel·lar')?.click();
    fixture.detectChanges();

    expect(host.closedCalled).toBe(true);
  });

  it('"Tots" button sets numberOfCordons to null', () => {
    host.numberOfCordons.set(2);
    host.open.set(false);
    fixture.detectChanges();
    host.open.set(true);
    fixture.detectChanges();

    findButton(fixture, 'Tots')?.click();
    fixture.detectChanges();

    const display = fixture.nativeElement.querySelector('[aria-live="polite"]');
    expect(display?.textContent?.trim()).toBe('Tots');

    findButton(fixture, 'Desar')?.click();
    fixture.detectChanges();

    expect(host.savedEvent?.numberOfCordons).toBeNull();
  });

  it('does not render rengla section when rengles is empty', () => {
    host.rengles.set([]);
    fixture.detectChanges();
    const checkboxes = fixture.nativeElement.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(0);
  });
});
