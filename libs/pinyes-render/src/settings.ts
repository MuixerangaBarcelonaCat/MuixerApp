// Secondary entry point: the render-settings token alone, without the Konva components of the
// main barrel, so app-wide code (app.config, root services) can provide it without growing the
// initial bundle.
export * from './lib/settings/render-settings';
