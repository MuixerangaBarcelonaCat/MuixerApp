import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  booleanAttribute,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TableKit } from '@tiptap/extension-table';
import {
  LucideAngularModule,
  Bold,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Heading2,
  Heading3,
} from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { InputComponent } from '../input/input.component';
import { ModalComponent } from '../modal/modal.component';
import { EmojiButtonComponent } from './emoji-button.component';

/**
 * WYSIWYG editor whose value is Markdown: the string goes in and comes back out, and the user
 * never sees the syntax. Tiptap is driven imperatively on a plain element — same reasoning as
 * Konva elsewhere in this repo, no framework wrapper in between.
 *
 * Tables have no toolbar button on purpose, but `TableKit` is registered so that a table already
 * present in the Markdown survives a round trip instead of being dropped on the next save.
 */
@Component({
  selector: 'lib-markdown-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    ModalComponent,
    EmojiButtonComponent,
  ],
  templateUrl: './markdown-editor.component.html',
})
export class MarkdownEditorComponent {
  readonly value = input<string>('');
  readonly valueChange = output<string>();
  readonly placeholder = input<string>();
  readonly ariaLabel = input<string>();
  readonly disabled = input(false, { transform: booleanAttribute });

  protected readonly Bold = Bold;
  protected readonly Italic = Italic;
  protected readonly LinkIcon = LinkIcon;
  protected readonly List = List;
  protected readonly ListOrdered = ListOrdered;
  protected readonly Heading2 = Heading2;
  protected readonly Heading3 = Heading3;

  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');
  private editor: Editor | null = null;

  /**
   * Bumped on every transaction. The toolbar's `isActive` reads it so that the template — which
   * has no other signal to depend on — recomputes as the caret moves. These apps are zoneless,
   * so nothing else would trigger change detection for a ProseMirror event.
   */
  private readonly revision = signal(0);

  /** The last Markdown this component emitted, so echoing it back is not treated as external. */
  private lastEmitted: string | null = null;

  protected readonly linkModalOpen = signal(false);
  protected readonly linkUrl = signal('');
  protected readonly linkText = signal('');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.editor?.destroy());

    effect(() => {
      const element = this.host().nativeElement;
      const markdown = this.value();

      if (!this.editor) {
        this.editor = this.createEditor(element, markdown);
        return;
      }

      // Only react to a value that did not originate here; re-parsing our own emission would
      // rebuild the document and throw the caret back to the start mid-typing.
      if (markdown !== this.lastEmitted && markdown !== this.currentMarkdown()) {
        this.editor.commands.setContent(markdown, { contentType: 'markdown' });
      }
    });

    effect(() => {
      const isDisabled = this.disabled();
      this.editor?.setEditable(!isDisabled, false);
      this.revision.update((n) => n + 1);
    });

    effect(() => {
      const label = this.ariaLabel();
      const editorElement = this.editor?.view.dom;
      if (editorElement) {
        if (label) {
          editorElement.setAttribute('aria-label', label);
        } else {
          editorElement.removeAttribute('aria-label');
        }
      }
    });
  }

  private createEditor(element: HTMLElement, markdown: string): Editor {
    return new Editor({
      element,
      extensions: [StarterKit, Markdown, TableKit],
      content: markdown,
      contentType: 'markdown',
      editable: !this.disabled(),
      editorProps: {
        attributes: {
          class: 'prose prose-sm max-w-none focus:outline-none min-h-32 px-3 py-2',
          ...(this.ariaLabel() ? { 'aria-label': this.ariaLabel() } : {}),
          ...(this.placeholder() ? { 'data-placeholder': this.placeholder() } : {}),
        },
      },
      onUpdate: () => {
        this.lastEmitted = this.currentMarkdown();
        this.valueChange.emit(this.lastEmitted);
        this.revision.update((n) => n + 1);
      },
      onSelectionUpdate: () => this.revision.update((n) => n + 1),
    });
  }

  /**
   * The serializer leaves a trailing blank line on most documents. Trimming makes the emitted
   * value idempotent — re-parsing it and serializing again yields the same string — which keeps
   * callers' "has this changed?" comparisons honest.
   */
  private currentMarkdown(): string {
    return this.editor?.getMarkdown().trim() ?? '';
  }

  /** Reads `revision` so the toolbar re-renders as the caret moves through formatted text. */
  protected isActive(name: string, attrs?: Record<string, unknown>): boolean {
    this.revision();
    return this.editor?.isActive(name, attrs) ?? false;
  }

  protected toggleBold(): void {
    this.editor?.chain().focus().toggleBold().run();
  }

  protected toggleItalic(): void {
    this.editor?.chain().focus().toggleItalic().run();
  }

  protected toggleBulletList(): void {
    this.editor?.chain().focus().toggleBulletList().run();
  }

  protected toggleOrderedList(): void {
    this.editor?.chain().focus().toggleOrderedList().run();
  }

  protected toggleHeading(level: 2 | 3): void {
    this.editor?.chain().focus().toggleHeading({ level }).run();
  }

  protected insertEmoji(emoji: string): void {
    this.editor?.chain().focus().insertContent(emoji).run();
  }

  protected openLinkModal(): void {
    const editor = this.editor;
    if (!editor) return;

    const href: string = editor.getAttributes('link')['href'] ?? '';
    // With the caret merely sitting inside a link, widen the selection to the whole link so that
    // confirming rewrites it rather than inserting a second link inside the first.
    if (href) {
      editor.commands.extendMarkRange('link');
    }

    const { from, to, empty } = editor.state.selection;
    this.linkUrl.set(href);
    this.linkText.set(empty ? '' : editor.state.doc.textBetween(from, to, ' '));
    this.linkModalOpen.set(true);
  }

  protected closeLinkModal(): void {
    this.linkModalOpen.set(false);
  }

  protected confirmLink(): void {
    const url = this.linkUrl().trim();
    this.linkModalOpen.set(false);
    if (!url || !this.editor) return;

    // Inserted as a node rather than as Markdown source: the label is arbitrary user text, and
    // `[` or `*` in it would otherwise be reparsed as syntax.
    this.editor
      .chain()
      .focus()
      .insertContent({
        type: 'text',
        text: this.linkText().trim() || url,
        marks: [{ type: 'link', attrs: { href: url } }],
      })
      .run();
  }
}
