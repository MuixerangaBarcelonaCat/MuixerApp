// jsdom implements <dialog>'s `open` attribute reflection but not showModal()/close() at all
// (neither exists on the prototype) — needed for lib-modal (@muixer/ui), which uses native
// dialog semantics. Mirrors the identical polyfill in apps/dashboard/src/test-setup.ts and
// libs/ui/src/test-setup.ts.
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
