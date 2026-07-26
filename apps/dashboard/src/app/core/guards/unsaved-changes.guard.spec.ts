import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable, of } from 'rxjs';
import { vi } from 'vitest';
import { unsavedChangesGuard } from './unsaved-changes.guard';

describe('unsavedChangesGuard', () => {
  it('delegates to the leaving component canDeactivate() when it returns a boolean', () => {
    const component = { canDeactivate: vi.fn().mockReturnValue(true) };
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as never, {} as never, {} as never),
    );
    expect(component.canDeactivate).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  it('delegates to the leaving component canDeactivate() when it returns an Observable', async () => {
    const component = { canDeactivate: vi.fn().mockReturnValue(of(true)) };
    const result = TestBed.runInInjectionContext(() =>
      unsavedChangesGuard(component, {} as never, {} as never, {} as never),
    );
    expect(await firstValueFrom(result as Observable<boolean>)).toBe(true);
  });
});
