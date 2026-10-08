import { TestBed } from '@angular/core/testing';
import { InstanceDetail, SegmentDetail } from '@muixer/pinyes-render';
import { ToastService } from '@muixer/ui';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CompositionService } from './composition.service';
import { FigureInstanceService } from './figure-instance.service';
import { SegmentFigureAddService } from './segment-figure-add.service';

const instance = (id: string) => ({ id }) as InstanceDetail;

describe('SegmentFigureAddService', () => {
  let service: SegmentFigureAddService;
  let instanceService: { create: ReturnType<typeof vi.fn> };
  let compositionService: { applyToSegment: ReturnType<typeof vi.fn> };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    instanceService = { create: vi.fn() };
    compositionService = { applyToSegment: vi.fn() };
    toast = { success: vi.fn(), error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: FigureInstanceService, useValue: instanceService },
        { provide: CompositionService, useValue: compositionService },
        { provide: ToastService, useValue: toast },
      ],
    });
    service = TestBed.inject(SegmentFigureAddService);
  });

  describe('addFigures()', () => {
    it('creates the figures one after another, so the server appends them in pick order', () => {
      const first = new Subject<InstanceDetail>();
      instanceService.create.mockReturnValueOnce(first).mockReturnValueOnce(of(instance('i2')));
      const emitted: InstanceDetail[][] = [];

      service
        .addFigures('ev', 'seg', [{ figureTemplateId: 'f1' }, { figureTemplateId: 'f2' }])
        .subscribe((created) => emitted.push(created));

      expect(instanceService.create).toHaveBeenCalledTimes(1);
      first.next(instance('i1'));
      first.complete();

      expect(instanceService.create).toHaveBeenNthCalledWith(2, 'ev', 'seg', { figureTemplateId: 'f2' });
      expect(emitted).toEqual([[instance('i1'), instance('i2')]]);
    });

    it('confirms how many figures were added', () => {
      instanceService.create.mockReturnValueOnce(of(instance('i1'))).mockReturnValueOnce(of(instance('i2')));
      service.addFigures('ev', 'seg', [{ figureTemplateId: 'f1' }, { figureTemplateId: 'f2' }]).subscribe();
      expect(toast.success).toHaveBeenCalledWith("S'han afegit 2 figures.");
    });

    it('uses the singular for one figure', () => {
      instanceService.create.mockReturnValueOnce(of(instance('i1')));
      service.addFigures('ev', 'seg', [{ figureTemplateId: 'f1' }]).subscribe();
      expect(toast.success).toHaveBeenCalledWith("S'ha afegit 1 figura.");
    });

    it('on a partial failure stops, and still emits the figures already created', () => {
      instanceService.create
        .mockReturnValueOnce(of(instance('i1')))
        .mockReturnValueOnce(throwError(() => new Error('boom')));
      const emitted: InstanceDetail[][] = [];

      service
        .addFigures('ev', 'seg', [{ figureTemplateId: 'f1' }, { figureTemplateId: 'f2' }, { figureTemplateId: 'f3' }])
        .subscribe((created) => emitted.push(created));

      expect(instanceService.create).toHaveBeenCalledTimes(2);
      expect(emitted).toEqual([[instance('i1')]]);
      expect(toast.error).toHaveBeenCalledWith("S'han afegit 1 de 3 figures. No s'ha pogut afegir la resta.");
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('when nothing was created emits an empty list and reports the error', () => {
      instanceService.create.mockReturnValueOnce(throwError(() => new Error('boom')));
      const emitted: InstanceDetail[][] = [];

      service.addFigures('ev', 'seg', [{ figureTemplateId: 'f1' }]).subscribe((created) => emitted.push(created));

      expect(emitted).toEqual([[]]);
      expect(toast.error).toHaveBeenCalledWith("No s'han pogut afegir les figures.");
    });
  });

  describe('applyComposition()', () => {
    it('applies the composition, confirms it and emits the updated segment', () => {
      const segment = { id: 'seg' } as SegmentDetail;
      compositionService.applyToSegment.mockReturnValue(of(segment));
      const emitted: SegmentDetail[] = [];

      service
        .applyComposition('ev', 'seg', { compositionId: 'c1', compositionName: 'Pilars de plaça' })
        .subscribe((s) => emitted.push(s));

      expect(compositionService.applyToSegment).toHaveBeenCalledWith('ev', 'seg', 'c1');
      expect(emitted).toEqual([segment]);
      expect(toast.success).toHaveBeenCalledWith("S'ha aplicat la composició «Pilars de plaça».");
    });

    it('reports a failure and completes without emitting', () => {
      compositionService.applyToSegment.mockReturnValue(throwError(() => new Error('boom')));
      const next = vi.fn();
      const error = vi.fn();

      service.applyComposition('ev', 'seg', { compositionId: 'c1', compositionName: 'X' }).subscribe({ next, error });

      expect(next).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith("No s'ha pogut aplicar la composició.");
    });
  });
});
