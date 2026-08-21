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

// jsdom implements <dialog>'s `open` attribute reflection but not showModal()/close() at all
// (neither exists on the prototype) — needed for lib-modal (@muixer/ui), which uses native
// dialog semantics. Mirrors the identical polyfill in libs/ui/src/test-setup.ts.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement, returnValue?: string) {
    if (!this.hasAttribute('open')) {
      return;
    }
    this.removeAttribute('open');
    if (returnValue !== undefined) {
      this.returnValue = returnValue;
    }
    this.dispatchEvent(new Event('close'));
  };
}
