import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { AlreadyAssignedDialogComponent } from './already-assigned-dialog.component';
import { ConflictPlacement } from '../../models/assignment.model';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

const makePlacement = (over: Partial<ConflictPlacement> = {}): ConflictPlacement => ({
  assignmentId: 'a1',
  figureInstanceId: 'inst-1',
  figureName: 'pd4',
  nodeId: 'n1',
  nodeLabel: 'MANS',
  zone: 'PINYA',
  area: 'PINYA',
  z: 0,
  renglaPosition: 1,
  cordon: 1,
  ...over,
});

describe('AlreadyAssignedDialogComponent', () => {
  let fixture: ComponentFixture<AlreadyAssignedDialogComponent>;

  const setup = (placements: ConflictPlacement[]) => {
    TestBed.configureTestingModule({ providers: [allLucideIconsProvider] });
    fixture = TestBed.createComponent(AlreadyAssignedDialogComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('personAlias', 'Pepet');
    fixture.componentRef.setInput('nodeLabel', 'MANS');
    fixture.componentRef.setInput('figureName', 'pd4');
    fixture.componentRef.setInput('placements', placements);
    fixture.detectChanges();
  };

  it('lists every placement with its figure and node when several are provided', () => {
    setup([
      makePlacement({ figureName: 'pd4', nodeLabel: 'MANS', area: 'PINYA' }),
      makePlacement({ assignmentId: 'a2', figureName: 'Torre', nodeLabel: 'SEGON', zone: 'TRONC', area: 'TRONC' }),
    ]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('pd4');
    expect(text).toContain('MANS');
    expect(text).toContain('Torre');
    expect(text).toContain('SEGON');
  });

  it('warns when one of the placements is a tronc placement', () => {
    setup([makePlacement({ area: 'TRONC', zone: 'TRONC' })]);
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-conflict-placement]');
    expect(items.length).toBe(1);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text.toLowerCase()).toContain('tronc');
  });

  it('renders "Assignar igualment" as a warning-styled action, always behind the dialog (D8, Fase 5)', () => {
    setup([makePlacement()]);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Assignar igualment');
    const button: HTMLButtonElement | null = (fixture.nativeElement as HTMLElement).querySelector(
      'button.btn-warning',
    );
    expect(button).not.toBeNull();
    expect(button!.textContent).toContain('Assignar igualment');
  });

  it('emits assignAnywayRequested when "Assignar igualment" is clicked', () => {
    setup([makePlacement()]);
    const emitted = vi.fn();
    fixture.componentInstance.assignAnywayRequested.subscribe(emitted);
    const button: HTMLButtonElement = (fixture.nativeElement as HTMLElement).querySelector('button.btn-warning')!;
    button.click();
    expect(emitted).toHaveBeenCalled();
  });

  it('falls back to the single-sentence summary when no placements are provided', () => {
    setup([]);
    const items = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-conflict-placement]');
    expect(items.length).toBe(0);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Pepet');
  });
});
