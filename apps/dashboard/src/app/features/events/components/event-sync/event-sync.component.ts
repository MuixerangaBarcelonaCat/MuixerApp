import {
  Component,
  ChangeDetectionStrategy,
  computed,
  effect,
  inject,
  signal,
  ElementRef,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { SyncEvent, EventType } from '../../models/event.model';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { environment } from '../../../../../environments/environment';

type SyncState = 'idle' | 'running' | 'complete' | 'error';

@Component({
  selector: 'app-event-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './event-sync.component.html',
  styleUrls: ['./event-sync.component.scss'],
})
export class EventSyncComponent implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  private get listBase(): string {
    const type = this.route.snapshot.data['eventType'] as EventType | undefined;
    return type === EventType.ACTUACIO ? '/performances' : '/rehearsals';
  }

  @ViewChild('logContainer') logContainer!: ElementRef<HTMLDivElement>;

  syncState = signal<SyncState>('idle');
  events = signal<SyncEvent[]>([]);
  summary = signal<{ newEvents: number; updatedEvents: number; errors: number } | null>(null);

  progress = computed(() => {
    const evts = this.events();
    const progressEvents = evts.filter(
      (e) => e.type === 'progress' && e.entity === 'event' && e.current && e.total,
    );
    if (progressEvents.length === 0) return 0;
    const last = progressEvents[progressEvents.length - 1];
    return Math.round(((last.current || 0) / (last.total || 1)) * 100);
  });

  private eventSource: EventSource | null = null;

  constructor() {
    effect(() => {
      if (this.events().length > 0) {
        setTimeout(() => this.scrollToBottom(), 50);
      }
    });
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  startSync() {
    const token = this.authService.getAccessToken();
    if (!token) {
      this.syncState.set('error');
      this.events.set([{ type: 'error', entity: 'auth', message: 'No s\'ha pogut obtenir el token d\'autenticació' }]);
      return;
    }

    this.syncState.set('running');
    this.events.set([]);
    this.summary.set(null);

    const url = `${environment.apiUrl}/sync/events?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      const syncEvent: SyncEvent = JSON.parse(event.data as string);
      this.events.update((evts) => [...evts, syncEvent]);

      if (syncEvent.type === 'complete') {
        this.syncState.set('complete');
        if (syncEvent.detail) {
          this.summary.set({
            newEvents: (syncEvent.detail['newEvents'] as number) || 0,
            updatedEvents: (syncEvent.detail['updatedEvents'] as number) || 0,
            errors: (syncEvent.detail['errors'] as number) || 0,
          });
        }
        this.closeEventSource();
      } else if (syncEvent.type === 'error' && syncEvent.entity === 'sync') {
        this.syncState.set('error');
        this.closeEventSource();
      }
    };

    this.eventSource.onerror = () => {
      this.events.update((evts) => [
        ...evts,
        { type: 'error', entity: 'connection', message: 'Error de connexió amb el servidor' },
      ]);
      this.syncState.set('error');
      this.closeEventSource();
    };
  }

  cancelSync() {
    this.closeEventSource();
    this.events.update((evts) => [
      ...evts,
      { type: 'error', entity: 'sync', message: "Sincronització cancel·lada per l'usuari" },
    ]);
    this.syncState.set('idle');
  }

  resetSync() {
    this.syncState.set('idle');
    this.events.set([]);
    this.summary.set(null);
  }

  goBack() {
    this.router.navigate([this.listBase]);
  }

  goBackAndReload() {
    this.router.navigate([this.listBase]).then(() => window.location.reload());
  }

  getEventColorClass(type: string): string {
    switch (type) {
      case 'start': return 'text-info';
      case 'progress': return 'text-success';
      case 'warn': return 'text-warning';
      case 'error': return 'text-error';
      case 'complete': return 'text-success font-bold';
      default: return 'text-base-content/60';
    }
  }

  private closeEventSource() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private scrollToBottom() {
    if (this.logContainer) {
      const el = this.logContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
