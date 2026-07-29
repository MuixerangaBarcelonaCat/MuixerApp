import { vi } from 'vitest';

if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator.userAgent) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'vitest' },
    writable: true,
    configurable: true,
  });
}

(globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
