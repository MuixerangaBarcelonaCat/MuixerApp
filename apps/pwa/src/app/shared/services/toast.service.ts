import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  private _counter = 0;

  readonly toasts = this._toasts.asReadonly();

  success(message: string): void {
    this.show(message, 'success', 3000);
  }

  error(message: string): void {
    this.show(message, 'error', 5000);
  }

  info(message: string): void {
    this.show(message, 'info', 3000);
  }

  dismiss(id: number): void {
    this._toasts.update((ts) => ts.filter((t) => t.id !== id));
  }

  private show(message: string, type: Toast['type'], duration: number): void {
    const id = ++this._counter;
    this._toasts.update((ts) => [...ts, { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
