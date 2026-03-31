import { Observable } from 'rxjs';
import { SyncEvent } from './sync-event.interface';

export interface SyncStrategy {
  execute(): Observable<SyncEvent>;
}
