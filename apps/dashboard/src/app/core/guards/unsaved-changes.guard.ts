import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/** Implemented by components that may have unflushed edits pending when the route changes. */
export interface CanComponentDeactivate {
  canDeactivate(): Observable<boolean> | boolean;
}

/** Delegates the deactivation decision to the leaving component so it can flush pending autosaves first. */
export const unsavedChangesGuard: CanDeactivateFn<CanComponentDeactivate> = (component) =>
  component.canDeactivate();
