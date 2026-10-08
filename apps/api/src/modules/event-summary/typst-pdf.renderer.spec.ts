import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { TypstCompileError, TypstPdfRenderer } from './typst-pdf.renderer';

// The native class's static `create` is read-only, so wrap it (still delegating to the real
// compiler) to count how many compilers get created.
jest.mock('@myriaddreamin/typst-ts-node-compiler', () => {
  const actual = jest.requireActual('@myriaddreamin/typst-ts-node-compiler');
  return { ...actual, NodeCompiler: { create: jest.fn((args) => actual.NodeCompiler.create(args)) } };
});

describe('TypstPdfRenderer', () => {
  let assetsDir: string;
  let renderer: TypstPdfRenderer;

  beforeEach(() => {
    assetsDir = mkdtempSync(join(tmpdir(), 'typst-renderer-'));
    writeFileSync(
      join(assetsDir, 'probe.typ'),
      [
        '#let data = json(bytes(sys.inputs.data))',
        '#set document(title: data.title)',
        '#for item in data.items [#text(item)<item>]',
        '#block(breakable: false)[#for item in data.items [#strong(item) ]]<group>',
      ].join('\n'),
    );
    writeFileSync(join(assetsDir, 'broken.typ'), '#panic("boom")');
    renderer = new TypstPdfRenderer(assetsDir);
  });

  afterEach(() => {
    rmSync(assetsDir, { recursive: true, force: true });
    jest.clearAllMocks();
  });

  it('hands the data to the template as JSON', () => {
    const doc = renderer.compile('probe.typ', { title: 'Assaig general', items: [] });

    expect(doc.title).toBe('Assaig general');
  });

  it('keeps Typst syntax in the data as literal text', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: ['#panic("x") *a* $b$'] });

    expect(doc.labelledTexts('item')).toEqual(['#panic("x") *a* $b$']);
  });

  it('returns labelled texts in document order', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: ['u', 'dos', 'tres'] });

    expect(doc.labelledTexts('item')).toEqual(['u', 'dos', 'tres']);
    expect(doc.labelledTexts('missing')).toEqual([]);
  });

  it('collects every text nested inside a labelled element, in order', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: ['u', 'dos'] });

    expect(doc.textsWithin('group')).toEqual(['u', 'dos']);
    expect(doc.textsWithin('missing')).toEqual([]);
  });

  it('reads a field of every labelled element', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: [] });

    expect(doc.fieldOf('group', 'breakable')).toEqual([false]);
    expect(doc.fieldOf('missing', 'breakable')).toEqual([]);
  });

  it('counts the elements matching a selector', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: ['u', 'dos'] });

    expect(doc.count('<item>')).toBe(2);
    expect(doc.count('heading')).toBe(0);
  });

  it('exports the compiled document as a PDF', () => {
    const doc = renderer.compile('probe.typ', { title: 't', items: ['x'] });

    expect(doc.pageCount).toBe(1);
    expect(doc.pdf().subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('throws a TypstCompileError carrying the diagnostics when the template fails', () => {
    expect(() => renderer.compile('broken.typ', {})).toThrow(TypstCompileError);
    expect(() => renderer.compile('broken.typ', {})).toThrow(/boom/);
  });

  it('creates the native compiler once and reuses it', () => {
    renderer.compile('probe.typ', { title: 'a', items: [] });
    renderer.compile('probe.typ', { title: 'b', items: [] });

    expect(NodeCompiler.create).toHaveBeenCalledTimes(1);
  });
});
