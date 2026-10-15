import { inject, Injectable } from '@angular/core';
import { CreateInstancePayload, InstanceDetail, SegmentDetail } from '@muixer/pinyes-render';
import { ToastService } from '@muixer/ui';
import { catchError, concatMap, defer, EMPTY, from, Observable, of, tap, toArray } from 'rxjs';
import { CompositionService } from './composition.service';
import { FigureInstanceService } from './figure-instance.service';

/**
 * «+ Figura» picker flow shared by the segment list and the Troncs tab: creates the picked
 * figures or applies a composition, and reports the outcome with a toast.
 */
@Injectable({ providedIn: 'root' })
export class SegmentFigureAddService {
  private readonly instanceService = inject(FigureInstanceService);
  private readonly compositionService = inject(CompositionService);
  private readonly toast = inject(ToastService);

  /**
   * Creates the figures one at a time, so the server appends them in pick order (and with it
   * each figure's number and color). Stops at the first failure and still emits the figures
   * already created, so the caller can show them: retrying the whole pick would duplicate them.
   * Never errors.
   */
  addFigures(eventId: string, segmentId: string, selections: CreateInstancePayload[]): Observable<InstanceDetail[]> {
    return defer(() => {
      const created: InstanceDetail[] = [];
      return from(selections).pipe(
        concatMap((sel) => this.instanceService.create(eventId, segmentId, sel)),
        tap((instance) => created.push(instance)),
        toArray(),
        tap((instances) =>
          this.toast.success(instances.length === 1 ? "S'ha afegit 1 figura." : `S'han afegit ${instances.length} figures.`),
        ),
        catchError(() => {
          this.toast.error(
            created.length === 0
              ? "No s'han pogut afegir les figures."
              : `S'han afegit ${created.length} de ${selections.length} figures. No s'ha pogut afegir la resta.`,
          );
          return of(created);
        }),
      );
    });
  }

  /** Emits the updated segment; on failure reports it and completes without emitting. */
  applyComposition(
    eventId: string,
    segmentId: string,
    composition: { compositionId: string; compositionName: string },
  ): Observable<SegmentDetail> {
    return this.compositionService.applyToSegment(eventId, segmentId, composition.compositionId).pipe(
      tap(() => this.toast.success(`S'ha aplicat la composició «${composition.compositionName}».`)),
      catchError(() => {
        this.toast.error("No s'ha pogut aplicar la composició.");
        return EMPTY;
      }),
    );
  }
}
