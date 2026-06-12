import { Injectable, computed, signal } from '@angular/core';
import { Observable, of, Subscription } from 'rxjs';

export interface UndoableAction {
  type: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  execute: () => void | Observable<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  undo: () => void | Observable<any>;
}

const MAX_STACK_SIZE = 50;

/**
 * Generic in-memory undo/redo stack.
 * Provide at component level so each consumer gets an independent stack.
 *
 * Supports both synchronous (signal mutations) and async (HTTP) actions:
 * - Sync: execute/undo return void
 * - Async: execute/undo return Observable<void>
 */
@Injectable()
export class UndoRedoService {
  private readonly undoStack = signal<UndoableAction[]>([]);
  private readonly redoStack = signal<UndoableAction[]>([]);
  private activeSub: Subscription | null = null;

  readonly canUndo = computed(() => this.undoStack().length > 0);
  readonly canRedo = computed(() => this.redoStack().length > 0);
  readonly undoDescription = computed(() => {
    const stack = this.undoStack();
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  });
  readonly redoDescription = computed(() => {
    const stack = this.redoStack();
    return stack.length > 0 ? stack[stack.length - 1].description : null;
  });
  readonly isBusy = signal(false);

  push(action: UndoableAction): void {
    this.undoStack.update((stack) => {
      const next = [...stack, action];
      if (next.length > MAX_STACK_SIZE) next.shift();
      return next;
    });
    this.redoStack.set([]);
  }

  replaceLast(action: UndoableAction): void {
    this.undoStack.update((stack) => {
      if (stack.length === 0) return [action];
      const next = [...stack];
      next[next.length - 1] = action;
      return next;
    });
  }

  undo(): Observable<void> {
    if (this.isBusy() || !this.canUndo()) return of(void 0);
    const stack = this.undoStack();
    const action = stack[stack.length - 1];
    this.undoStack.set(stack.slice(0, -1));

    return this.run(
      action.undo,
      () => this.redoStack.update((s) => [...s, action]),
      () => this.undoStack.update((s) => [...s, action]),
    );
  }

  redo(): Observable<void> {
    if (this.isBusy() || !this.canRedo()) return of(void 0);
    const stack = this.redoStack();
    const action = stack[stack.length - 1];
    this.redoStack.set(stack.slice(0, -1));

    return this.run(
      action.execute,
      () => this.undoStack.update((s) => [...s, action]),
      () => this.redoStack.update((s) => [...s, action]),
    );
  }

  clear(): void {
    this.undoStack.set([]);
    this.redoStack.set([]);
    this.activeSub?.unsubscribe();
    this.activeSub = null;
    this.isBusy.set(false);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private run(fn: () => void | Observable<any>, onSuccess: () => void, onError?: () => void): Observable<void> {
    const result = fn();
    if (!result || !(result instanceof Observable)) {
      onSuccess();
      return of(void 0);
    }

    this.isBusy.set(true);
    return new Observable<void>((subscriber) => {
      this.activeSub = result.subscribe({
        next: () => {
          this.isBusy.set(false);
          onSuccess();
          subscriber.next();
          subscriber.complete();
        },
        error: (err) => {
          this.isBusy.set(false);
          onError?.();
          subscriber.error(err);
        },
      });
    });
  }
}
