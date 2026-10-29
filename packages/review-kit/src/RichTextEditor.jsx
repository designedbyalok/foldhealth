import { useEditor, useEditorState, EditorContent } from '@tiptap/react';
// Named import: the default export doesn't survive every CommonJS interop.
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon, BulletListIcon, OrderedListIcon, LinkIcon, CodeIcon } from './icons';

const imagesIn = (list) => [...(list || [])].filter(f => f.type.startsWith('image/'));

/**
 * Rich-text comment field (Tiptap): bold, italic, underline, strike, lists,
 * links and inline code. Pasted or dropped images go to `onFiles` instead of
 * into the text. Cmd/Ctrl+Enter calls `onSubmit`.
 *
 * @param {object}   props
 * @param {string}   props.placeholder
 * @param {(value: { html: string, text: string, empty: boolean }) => void} props.onChange
 * @param {(files: File[]) => void} props.onFiles
 * @param {() => void} props.onSubmit
 * @param {string}   [props.initialHtml] content to start with (remount with a new `key` to switch)
 * @param {boolean}  [props.autoFocus]
 * @param {object}   props.labels      merged labels (formatting names, link prompt)
 * @param {string}   [props.className]
 */
export function RichTextEditor({ placeholder, onChange, onFiles, onSubmit, initialHtml = '', autoFocus = false, labels, className }) {
  const editor = useEditor({
    // Render on the client only, so server rendering doesn't hydrate a mismatch.
    immediatelyRender: false,
    content: initialHtml,
    autofocus: autoFocus ? 'end' : false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        blockquote: false,
        link: { openOnClick: false, autolink: true, defaultProtocol: 'https' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    editorProps: {
      attributes: { class: 'rk-editor-content', 'aria-label': 'Comment' },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          onSubmit();
          return true;
        }
        return false;
      },
      handlePaste: (_view, event) => {
        if (!imagesIn(event.clipboardData?.files).length) return false;
        onFiles([...event.clipboardData.files]);
        return true;
      },
      // Images dropped on the text attach to the point; stop the event so the
      // box's own drop zone doesn't attach them a second time.
      handleDrop: (_view, event) => {
        const files = [...(event.dataTransfer?.files || [])];
        if (!files.length) return false;
        event.preventDefault();
        event.stopPropagation();
        onFiles(files);
        return true;
      },
    },
    onUpdate: ({ editor: e }) => onChange({ html: e.getHTML(), text: e.getText().trim(), empty: e.isEmpty }),
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? {
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      bulletList: e.isActive('bulletList'),
      orderedList: e.isActive('orderedList'),
      link: e.isActive('link'),
      code: e.isActive('code'),
    } : {}),
  }) || {};

  if (!editor) return null;

  const run = (fn) => () => fn(editor.chain().focus()).run();
  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const url = window.prompt(labels.linkPrompt);
    if (url) editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const f = labels.formatting;
  const buttons = [
    ['bold', f.bold, BoldIcon, run(c => c.toggleBold())],
    ['italic', f.italic, ItalicIcon, run(c => c.toggleItalic())],
    ['underline', f.underline, UnderlineIcon, run(c => c.toggleUnderline())],
    ['strike', f.strike, StrikeIcon, run(c => c.toggleStrike())],
    ['bulletList', f.bulletList, BulletListIcon, run(c => c.toggleBulletList())],
    ['orderedList', f.orderedList, OrderedListIcon, run(c => c.toggleOrderedList())],
    ['link', f.link, LinkIcon, toggleLink],
    ['code', f.code, CodeIcon, run(c => c.toggleCode())],
  ];

  return (
    <div className={className ? `rk-editor ${className}` : 'rk-editor'}>
      <div className="rk-format-bar" role="toolbar" aria-label="Formatting">
        {buttons.map(([key, label, Glyph, onClick]) => (
          <button
            key={key}
            type="button"
            className={`rk-format-btn${active[key] ? ' rk-format-btn-on' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={onClick}
            aria-label={label}
            aria-pressed={!!active[key]}
            title={label}
          >
            <Glyph />
          </button>
        ))}
      </div>
      <EditorContent editor={editor} className="rk-editor-scroll" />
    </div>
  );
}
