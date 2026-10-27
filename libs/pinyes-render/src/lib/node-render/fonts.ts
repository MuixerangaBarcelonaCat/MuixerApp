import { InjectionToken, Signal, signal } from '@angular/core';

/** The faces the canvas draws text with: Atkinson for names, Quicksand for everything else. */
export const CANVAS_FONTS = ['700 16px "Atkinson Hyperlegible Next"', '700 16px Quicksand'];

/**
 * Waits for the canvas faces. Konva measures text when it draws, so a face that arrives later
 * would leave names fitted to the fallback font: the canvas redraws once this resolves. It never
 * rejects; a face that fails to load just leaves the fallback in place.
 */
export async function loadCanvasFonts(fonts: FontFaceSet | undefined): Promise<void> {
  if (!fonts) return;
  await Promise.allSettled(CANVAS_FONTS.map((font) => fonts.load(font)));
}

/**
 * True once the canvas faces have loaded (or failed to). The SVG node painter reads it so names
 * fitted to the fallback font are measured again, as the Konva canvas redraws on `loadCanvasFonts`.
 */
export const CANVAS_FONTS_LOADED = new InjectionToken<Signal<boolean>>('CANVAS_FONTS_LOADED', {
  providedIn: 'root',
  factory: () => {
    const loaded = signal(false);
    void loadCanvasFonts(globalThis.document?.fonts).then(() => loaded.set(true));
    return loaded.asReadonly();
  },
});
