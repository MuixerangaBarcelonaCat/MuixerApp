// Deliberately NOT re-exported from `@muixer/ui`. Tiptap is ~500 kB of ProseMirror, and an
// `export *` from the main barrel drags it into every chunk that imports anything from the
// library — Angular's component metadata registration reads as a side effect, so the bundler
// cannot shake it out. Importing from `@muixer/ui/markdown-editor` keeps it isolated, so an
// `@defer` block in the consumer is what decides when it loads.
export * from './lib/components/markdown-editor/markdown-editor.component';
