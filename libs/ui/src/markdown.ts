// Kept out of the main `@muixer/ui` barrel for the same reason as the editor: `marked` is ~40 kB
// and only the two lazily-routed screens that render stored Markdown need it, so an `export *`
// from the barrel would move that cost into every app's initial bundle.
export * from './lib/services/markdown.service';
export * from './lib/components/markdown-view/markdown-view.component';
