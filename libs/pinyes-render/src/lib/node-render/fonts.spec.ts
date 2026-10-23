import { CANVAS_FONTS, loadCanvasFonts } from './fonts';

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
