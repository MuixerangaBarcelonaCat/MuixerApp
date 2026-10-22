/** Where `apps/dashboard/project.json` copies `docs/manual` in the built app. */
export const MANUAL_ASSET_BASE = '/manual';

/**
 * Manual pages reference images as `img/x.png` so they also render on GitHub and in Obsidian;
 * in the app they would resolve against `/config/manual/...`, so point them at the asset folder.
 */
export function rewriteManualImages(html: string): string {
  return html.replace(/src="(?:\.\/)?img\//g, `src="${MANUAL_ASSET_BASE}/img/`);
}

/** `04-etiquetes.md`, `./04-etiquetes.md#x` → `04-etiquetes`; anything else (external, absolute) → null. */
export function manualSlugFromHref(href: string | null): string | null {
  const match = href?.match(/^(?:\.\/)?([\w-]+)\.md(?:#.*)?$/);
  return match ? match[1] : null;
}
