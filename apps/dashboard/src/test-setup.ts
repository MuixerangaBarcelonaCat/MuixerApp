import { vi } from 'vitest';

(globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
