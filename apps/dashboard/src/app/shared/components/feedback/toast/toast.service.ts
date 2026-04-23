import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private counter = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string): void { this.add(message, 'success'); }
  error(message: string): void { this.add(message, 'error'); }
  warning(message: string): void { this.add(message, 'warning'); }
  info(message: string): void { this.add(message, 'info'); }

  remove(id: number): void {
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  private add(message: string, type: ToastType): void {
    const id = ++this.counter;
    this.toasts.update(toasts => [...toasts, { id, message, type }]);
    setTimeout(() => this.remove(id), 4000);
  }
}
