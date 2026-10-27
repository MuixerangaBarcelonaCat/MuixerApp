import { TestBed } from '@angular/core/testing';
import { CANVAS_FONTS, CANVAS_FONTS_LOADED, loadCanvasFonts } from './fonts';

describe('loadCanvasFonts', () => {
  it('loads the name and label faces the canvas draws with', async () => {
    const load = jest.fn().mockResolvedValue([]);
    await loadCanvasFonts({ load } as unknown as FontFaceSet);
    expect(load.mock.calls.map(([font]) => font)).toEqual(CANVAS_FONTS);
    expect(CANVAS_FONTS).toEqual([
      '700 16px "Atkinson Hyperlegible Next"',
      '700 16px Quicksand',
    ]);
  });

  it('resolves even when a face fails to load: the canvas then draws with the fallback', async () => {
    const load = jest.fn().mockRejectedValue(new Error('offline'));
    await expect(loadCanvasFonts({ load } as unknown as FontFaceSet)).resolves.toBeUndefined();
  });

  it('resolves at once where there is no font loading API', async () => {
    await expect(loadCanvasFonts(undefined)).resolves.toBeUndefined();
  });
});

describe('CANVAS_FONTS_LOADED', () => {
  const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');
  afterEach(() => {
    if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts);
    else delete (document as unknown as Record<string, unknown>)['fonts'];
  });

  it('turns true once the canvas faces have loaded, so SVG names can be measured again', async () => {
    let finish: () => void = () => undefined;
    const pending = new Promise<void>((resolve) => (finish = resolve));
    Object.defineProperty(document, 'fonts', { configurable: true, value: { load: () => pending } });

    const loaded = TestBed.inject(CANVAS_FONTS_LOADED);
    expect(loaded()).toBe(false);

    finish();
    await pending;
    await Promise.resolve();
    await Promise.resolve();
    expect(loaded()).toBe(true);
  });
});
