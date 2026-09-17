import { Injectable } from '@angular/core';

/**
 * Identifies this browser tab so a live-push event can be recognized as this
 * tab's own echo. One id per tab lifetime — no `localStorage`: a fresh id after
 * a hard refresh is fine, since F5 is exactly what live push removes the need for.
 */
@Injectable({ providedIn: 'root' })
export class ClientIdService {
  readonly id = crypto.randomUUID();
}
