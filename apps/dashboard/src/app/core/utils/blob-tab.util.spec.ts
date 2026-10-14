import { BLOB_TAB_URL_LIFETIME_MS, openPendingTab, showBlobInTab } from './blob-tab.util';

/** Just enough of a `Window` for the util: what it writes to, and what it reads back. */
const fakeTab = () => {
  const doc = document.implementation.createHTMLDocument('');
  return { document: doc, location: { href: '' }, opener: {} as unknown, close: vi.fn() };
};

describe('openPendingTab', () => {
  afterEach(() => vi.restoreAllMocks());

  it('opens a blank tab that tells the user the document is on its way', () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    const result = openPendingTab("S'està generant el resum...");

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(result).toBe(tab);
    expect(tab.document.body.textContent).toBe("S'està generant el resum...");
  });

  // `noopener` would make `window.open` return null, and the handle is needed to navigate the tab
  // later — so the back-reference is cut by hand instead.
  it('cuts the new tab off from the dashboard', () => {
    const tab = fakeTab();
    vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);

    openPendingTab('...');

    expect(tab.opener).toBeNull();
  });

  it('returns null when the popup blocker refuses the tab', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(openPendingTab('...')).toBeNull();
  });
});

describe('showBlobInTab', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

  beforeEach(() => {
    vi.useFakeTimers();
    URL.createObjectURL = vi.fn().mockReturnValue('blob:resum');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
  });

  it('points the tab at the blob, so the browser viewer shows it without saving a file', () => {
    const tab = fakeTab();
    const blob = new Blob(['%PDF-'], { type: 'application/pdf' });

    showBlobInTab(tab as unknown as Window, blob);

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(tab.location.href).toBe('blob:resum');
  });

  // There is no reliable signal for the tab being closed, so the URL is released once the viewer
  // has certainly read it rather than living until the dashboard is closed.
  it('releases the blob URL once the viewer has had ample time to load it', () => {
    showBlobInTab(fakeTab() as unknown as Window, new Blob());

    vi.advanceTimersByTime(BLOB_TAB_URL_LIFETIME_MS - 1);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:resum');
  });
});
