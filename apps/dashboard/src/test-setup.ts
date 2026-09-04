import { vi } from 'vitest';

if (typeof globalThis.navigator === 'undefined' || !globalThis.navigator.userAgent) {
  Object.defineProperty(globalThis, 'navigator', {
    value: { userAgent: 'vitest' },
    writable: true,
    configurable: true,
  });
}

// A real (constructible) class, not `vi.fn().mockImplementation(() => ({...}))` — that shape
// isn't `new`-able, which throws for any component using the standard `new ResizeObserver(cb)`
// call (e.g. segment-conflict-panel's scroll-arrow visibility). Doesn't invoke the callback
// (jsdom has no real layout), so a test needing a resize to fire calls the component's own
// update path directly instead of relying on this observer.
class MockResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
(globalThis as unknown as Record<string, unknown>)['ResizeObserver'] = MockResizeObserver;

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
