import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { desktopOnlyGuard } from './desktop-only.guard';
import { ToastService } from '../../shared/components/feedback/toast/toast.service';

describe('desktopOnlyGuard', () => {
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockToast: { error: ReturnType<typeof vi.fn> };
  let originalInnerWidth: number;

  beforeEach(() => {
    originalInnerWidth = window.innerWidth;
    mockRouter = { navigate: vi.fn() };
    mockToast = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', {
      value: originalInnerWidth,
      writable: true,
      configurable: true,
    });
  });

  it('allows navigation on desktop (>= 1024px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('allows navigation on tablet portrait (>= 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 768, configurable: true });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('blocks navigation and shows toast on phone (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith(
      'Aquesta funcionalitat només està disponible en dispositius d\'escriptori o tauleta.',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pinyes']);
  });
});
