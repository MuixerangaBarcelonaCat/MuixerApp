/**
 * How long a blob URL shown in a tab stays valid. The viewer reads it within moments of the tab
 * navigating, and there is no reliable signal for the tab being closed, so it is released on a
 * timer. Reloading the tab after that fails; closing the dashboard tab releases it anyway.
 */
export const BLOB_TAB_URL_LIFETIME_MS = 60_000;

/**
 * Opens a blank tab showing `message`, to be filled later with {@link showBlobInTab}. Must run
 * synchronously inside the click: a tab opened once a request has come back is no longer tied to
 * the click, and popup blockers (Safari's above all) refuse it. Returns `null` when refused.
 */
export function openPendingTab(message: string): Window | null {
  // Not `noopener`: that makes `window.open` return null, and the handle is needed to navigate it.
  const tab = window.open('', '_blank');
  if (!tab) return null;
  // The tab only ever shows our own blob, but nothing in it needs to reach back into the dashboard.
  tab.opener = null;
  tab.document.body.textContent = message;
  return tab;
}

/** Shows `blob` in `tab` through the browser's own viewer — in memory, nothing is saved to disk. */
export function showBlobInTab(tab: Window, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  tab.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), BLOB_TAB_URL_LIFETIME_MS);
}
