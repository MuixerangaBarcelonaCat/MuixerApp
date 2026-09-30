import { saveBlob } from './save-blob.util';

describe('saveBlob', () => {
  const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const createObjectURL = vi.fn().mockReturnValue('blob:fake');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
  });

  afterEach(() => {
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    vi.restoreAllMocks();
  });

  it('downloads the blob under the given filename and releases the object URL', () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.href).toBe('blob:fake');
      expect(this.download).toBe('resum.pdf');
      expect(document.body.contains(this)).toBe(true);
    });
    const blob = new Blob(['%PDF-']);

    saveBlob(blob, 'resum.pdf');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
