import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { desktopOnlyGuard } from './desktop-only.guard';
import { ToastService } from '../../shared/components/feedback/toast/toast.service';

describe('desktopOnlyGuard', () => {
  let mockRouter: { navigate: ReturnType<typeof vi.fn> };
  let mockToast: { error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRouter = { navigate: vi.fn() };
    mockToast = { error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
        { provide: ToastService, useValue: mockToast },
      ],
    });
  });

  it('allows navigation on desktop (>= 1024px)', () => {
    vi.stubGlobal('window', { innerWidth: 1024 });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('allows navigation on tablet portrait (>= 768px)', () => {
    vi.stubGlobal('window', { innerWidth: 768 });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(true);
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('blocks navigation and shows toast on phone (< 768px)', () => {
    vi.stubGlobal('window', { innerWidth: 390 });

    const result = TestBed.runInInjectionContext(() => desktopOnlyGuard(null as any, null as any));

    expect(result).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith(
      'Aquesta funcionalitat només està disponible en dispositius d\'escriptori o tauleta.',
    );
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/pinyes']);
  });
});
