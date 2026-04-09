import { Component, ChangeDetectionStrategy, computed, effect, inject, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SyncEvent } from '../../models/person.model';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { environment } from '../../../../../environments/environment';

type SyncState = 'idle' | 'running' | 'complete' | 'error';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  templateUrl: './person-sync.component.html',
  styleUrls: ['./person-sync.component.scss'],
})
export class PersonSyncComponent implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  @ViewChild('logContainer') logContainer!: ElementRef<HTMLDivElement>;

  syncState = signal<SyncState>('idle');
  events = signal<SyncEvent[]>([]);
  summary = signal<{ new: number; updated: number; errors: number } | null>(null);

  progress = computed(() => {
    const evts = this.events();
    const progressEvents = evts.filter(
      (e) => e.type === 'progress' && e.entity === 'person' && e.current && e.total
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

    const url = `${environment.apiUrl}/sync/persons?token=${encodeURIComponent(token)}`;
    this.eventSource = new EventSource(url);

    this.eventSource.onmessage = (event) => {
      const syncEvent: SyncEvent = JSON.parse(event.data);
      this.events.update((evts) => [...evts, syncEvent]);

      if (syncEvent.type === 'complete') {
        this.syncState.set('complete');
        if (syncEvent.detail) {
          this.summary.set({
            new: (syncEvent.detail['new'] as number) || 0,
            updated: (syncEvent.detail['updated'] as number) || 0,
            errors: (syncEvent.detail['errors'] as number) || 0,
          });
        }
        this.closeEventSource();
      } else if (syncEvent.type === 'error' && syncEvent.entity === 'sync') {
        this.syncState.set('error');
        this.closeEventSource();
      }
    };

    this.eventSource.onerror = (err) => {
      console.error('EventSource error', err);
      this.events.update((evts) => [
        ...evts,
        {
          type: 'error',
          entity: 'connection',
          message: 'Error de connexió amb el servidor',
        },
      ]);
      this.syncState.set('error');
      this.closeEventSource();
    };
  }

  cancelSync() {
    this.closeEventSource();
    this.events.update((evts) => [
      ...evts,
      {
        type: 'error',
        entity: 'sync',
        message: 'Sincronització cancel·lada per l\'usuari',
      },
    ]);
    this.syncState.set('idle');
  }

  resetSync() {
    this.syncState.set('idle');
    this.events.set([]);
    this.summary.set(null);
  }

  goBack() {
    this.router.navigate(['/persons']);
  }

  goBackAndReload() {
    this.router.navigate(['/persons']).then(() => {
      window.location.reload();
    });
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
}
