import { Inject, Injectable } from '@nestjs/common';
import { join } from 'path';
import { NodeCompiler, NodeTypstDocument } from '@myriaddreamin/typst-ts-node-compiler';

/** Folder holding the `.typ` templates, `fonts/` and `vendor/` packages (copied to `dist` as assets). */
export const TYPST_ASSETS_DIR = Symbol('TYPST_ASSETS_DIR');

export class TypstCompileError extends Error {
  constructor(template: string, messages: string[]) {
    super(`Typst template "${template}" failed to compile: ${messages.join('; ')}`);
    this.name = 'TypstCompileError';
  }
}

/** A compiled document: export it as PDF, or inspect it (used by the template specs). */
export class CompiledTypstDocument {
  constructor(
    private readonly compiler: NodeCompiler,
    private readonly doc: NodeTypstDocument,
  ) {}

  get title(): string | null {
    return this.doc.title;
  }

  get pageCount(): number {
    return this.doc.numOfPages;
  }

  pdf(): Buffer {
    return this.compiler.pdf(this.doc);
  }

  /** How many elements match a Typst selector, e.g. `<app-logo>` or `columns`. */
  count(selector: string): number {
    return (this.compiler.query(this.doc, { selector }) as unknown[]).length;
  }

  /** One field (e.g. `columns`) of every `<label>` element, in document order. */
  fieldOf(label: string, field: string): unknown[] {
    return this.compiler.query(this.doc, { selector: `<${label}>`, field }) as unknown[];
  }

  /** Every text string anywhere inside the `<label>` elements, in document order. */
  textsWithin(label: string): string[] {
    const texts: string[] = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
      } else if (node && typeof node === 'object') {
        const element = node as Record<string, unknown>;
        if (element['func'] === 'text' && typeof element['text'] === 'string') texts.push(element['text']);
        Object.values(element).forEach(walk);
      }
    };
    walk(this.compiler.query(this.doc, { selector: `<${label}>` }));
    return texts;
  }

  /** The strings of every `text(...)<label>` element, in document order. */
  labelledTexts(label: string): string[] {
    const elements = this.compiler.query(this.doc, { selector: `<${label}>` }) as { text?: string }[];
    return elements.map((element) => element.text ?? '');
  }
}

/**
 * Compiles the Typst templates under `TYPST_ASSETS_DIR` in-process with the native Typst
 * compiler. Data goes in as JSON through `sys.inputs.data` — never spliced into the source — so
 * user text can't inject markup. Only the bundled fonts are used, so output is identical on every
 * machine, and templates can only read files inside the assets folder.
 */
@Injectable()
export class TypstPdfRenderer {
  private compiler: NodeCompiler | null = null;

  constructor(@Inject(TYPST_ASSETS_DIR) private readonly assetsDir: string) {}

  compile(template: string, data: unknown): CompiledTypstDocument {
    const compiler = this.getCompiler();
    const result = compiler.compile({
      mainFilePath: join(this.assetsDir, template),
      inputs: { data: JSON.stringify(data) },
    });

    const diagnostics = result.takeDiagnostics();
    const doc = result.result;
    if (!doc || result.hasError()) {
      const messages = diagnostics
        ? compiler.fetchDiagnostics(diagnostics).map((d: { message: string }) => d.message)
        : ['unknown error'];
      throw new TypstCompileError(template, messages);
    }

    // Typst memoises between compiles; drop entries unused for a few runs so memory stays flat.
    compiler.evictCache(10);
    return new CompiledTypstDocument(compiler, doc);
  }

  private getCompiler(): NodeCompiler {
    this.compiler ??= NodeCompiler.create({
      workspace: this.assetsDir,
      fontArgs: [{ fontPaths: [join(this.assetsDir, 'fonts')] }],
    });
    return this.compiler;
  }
}
