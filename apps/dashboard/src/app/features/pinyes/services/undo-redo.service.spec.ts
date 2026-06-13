import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { UndoRedoService, UndoableAction } from './undo-redo.service';

describe('UndoRedoService', () => {
  let service: UndoRedoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UndoRedoService],
    });
    service = TestBed.inject(UndoRedoService);
  });

  function noop(): void { /* no-op for tests */ }
  function makeAction(type: string, executeFn?: () => void, undoFn?: () => void): UndoableAction {
    return {
      type,
      description: `${type} action`,
      execute: executeFn ?? noop,
      undo: undoFn ?? noop,
    };
  }

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initial state', () => {
    it('should have canUndo=false and canRedo=false', () => {
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });

    it('should have null descriptions', () => {
      expect(service.undoDescription()).toBeNull();
      expect(service.redoDescription()).toBeNull();
    });
  });

  describe('push', () => {
    it('should enable canUndo after pushing an action', () => {
      service.push(makeAction('CREATE'));
      expect(service.canUndo()).toBe(true);
      expect(service.undoDescription()).toBe('CREATE action');
    });

    it('should clear redo stack on push', () => {
      const action1 = makeAction('A');
      const action2 = makeAction('B');
      service.push(action1);
      service.undo().subscribe();
      expect(service.canRedo()).toBe(true);

      service.push(action2);
      expect(service.canRedo()).toBe(false);
    });

    it('should drop oldest when stack exceeds 50 items', () => {
      for (let i = 0; i < 55; i++) {
        service.push(makeAction(`action-${i}`));
      }
      expect(service.canUndo()).toBe(true);

      let undoCount = 0;
      while (service.canUndo()) {
        service.undo().subscribe();
        undoCount++;
      }
      expect(undoCount).toBe(50);
    });
  });

  describe('undo (sync)', () => {
    it('should call the action undo function', () => {
      const undoFn = vi.fn();
      service.push(makeAction('A', undefined, undoFn));
      service.undo().subscribe();
      expect(undoFn).toHaveBeenCalledOnce();
    });

    it('should move action to redo stack', () => {
      service.push(makeAction('A'));
      service.undo().subscribe();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(true);
    });

    it('should undo in reverse order', () => {
      const undoCalls: string[] = [];
      service.push(makeAction('A', undefined, () => undoCalls.push('A')));
      service.push(makeAction('B', undefined, () => undoCalls.push('B')));
      service.push(makeAction('C', undefined, () => undoCalls.push('C')));

      service.undo().subscribe();
      service.undo().subscribe();
      service.undo().subscribe();

      expect(undoCalls).toEqual(['C', 'B', 'A']);
    });

    it('should be no-op when stack is empty', () => {
      service.undo().subscribe();
      expect(service.canUndo()).toBe(false);
    });
  });

  describe('redo (sync)', () => {
    it('should call the action execute function', () => {
      const execFn = vi.fn();
      service.push(makeAction('A', execFn));
      service.undo().subscribe();
      service.redo().subscribe();
      expect(execFn).toHaveBeenCalledOnce();
    });

    it('should move action back to undo stack', () => {
      service.push(makeAction('A'));
      service.undo().subscribe();
      expect(service.canRedo()).toBe(true);

      service.redo().subscribe();
      expect(service.canRedo()).toBe(false);
      expect(service.canUndo()).toBe(true);
    });
  });

  describe('undo/redo (async)', () => {
    it('should handle async undo', () => {
      const undoFn = vi.fn(() => of(undefined));
      service.push(makeAction('A', undefined, undoFn));

      let completed = false;
      service.undo().subscribe(() => (completed = true));

      expect(undoFn).toHaveBeenCalled();
      expect(completed).toBe(true);
      expect(service.canRedo()).toBe(true);
    });

    it('should handle async redo', () => {
      const execFn = vi.fn(() => of(undefined));
      service.push(makeAction('A', execFn));
      service.undo().subscribe();

      service.redo().subscribe();
      expect(execFn).toHaveBeenCalled();
    });

    it('should propagate errors from async undo', () => {
      const error = new Error('API error');
      const undoFn = vi.fn(() => throwError(() => error));
      service.push(makeAction('A', undefined, undoFn));

      let caught: Error | null = null;
      service.undo().subscribe({
        error: (err) => (caught = err),
      });

      expect(caught).toBe(error);
      expect(service.isBusy()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should reset both stacks', () => {
      service.push(makeAction('A'));
      service.push(makeAction('B'));
      service.undo().subscribe();

      service.clear();
      expect(service.canUndo()).toBe(false);
      expect(service.canRedo()).toBe(false);
    });
  });

  describe('replaceLast', () => {
    it('should replace the last action in the undo stack', () => {
      service.push(makeAction('A'));
      service.push(makeAction('B'));
      service.replaceLast(makeAction('C'));

      expect(service.undoDescription()).toBe('C action');
    });

    it('should add action if undo stack is empty', () => {
      service.replaceLast(makeAction('A'));
      expect(service.canUndo()).toBe(true);
      expect(service.undoDescription()).toBe('A action');
    });

    it('should not clear the redo stack', () => {
      service.push(makeAction('A'));
      service.undo().subscribe();
      expect(service.canRedo()).toBe(true);

      service.replaceLast(makeAction('B'));
      expect(service.canRedo()).toBe(true);
    });
  });

  describe('error recovery', () => {
    it('should restore action to undo stack on async undo error', () => {
      const error = new Error('API error');
      const undoFn = vi.fn(() => throwError(() => error));
      service.push(makeAction('A', undefined, undoFn));

      service.undo().subscribe({ error: noop });

      expect(service.canUndo()).toBe(true);
      expect(service.canRedo()).toBe(false);
    });

    it('should restore action to redo stack on async redo error', () => {
      const error = new Error('API error');
      const execFn = vi.fn(() => throwError(() => error));
      service.push(makeAction('A', execFn));
      service.undo().subscribe();

      service.redo().subscribe({ error: noop });

      expect(service.canRedo()).toBe(true);
      expect(service.canUndo()).toBe(false);
    });
  });
});
