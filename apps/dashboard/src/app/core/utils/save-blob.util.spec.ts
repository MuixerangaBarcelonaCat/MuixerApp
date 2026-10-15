import { saveBlob } from './save-blob.util';

describe('saveBlob', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const createObjectURL = vi.fn().mockReturnValue('blob:fake');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    revokeObjectURL.mockClear();
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    vi.useRealTimers();
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    vi.restoreAllMocks();
  });

  it('downloads the blob under the given filename', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:fake');
      expect(this.download).toBe('resum.pdf');
      expect(document.body.contains(this)).toBe(true);
    });
    const blob = new Blob(['%PDF-']);

    saveBlob(blob, 'resum.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.querySelector('a[download]')).toBeNull();
  });

  // Firefox and some Safari versions start the download asynchronously after `click()`: revoking
  // the URL right away can leave them reading a released blob and saving an empty file.
  it('releases the object URL only once the browser has had time to start the download', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveBlob(new Blob(['%PDF-']), 'resum.pdf');
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });
});
