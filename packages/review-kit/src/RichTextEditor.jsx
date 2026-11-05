import { useEffect, useRef, useState } from 'react';
import { useEditor, useEditorState, EditorContent, Mark, mergeAttributes } from '@tiptap/react';
// Named import: the default export doesn't survive every CommonJS interop.
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { BoldIcon, ItalicIcon, UnderlineIcon, StrikeIcon, BulletListIcon, OrderedListIcon, LinkIcon, CodeIcon } from './icons';

// Inline color mark: a <span style="color: …"> around selected text. Built as
// its own Mark instead of pulling @tiptap/extension-text-style + extension-color
// so the kit stays dependency-light.
const TextColor = Mark.create({
  name: 'textColor',
  addOptions: () => ({ HTMLAttributes: {} }),
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (el) => el.style.color || null,
        renderHTML: (attrs) => (attrs.color ? { style: `color: ${attrs.color}` } : {}),
      },
    };
  },
  parseHTML: () => [{ style: 'color', getAttrs: (v) => (v ? { color: v } : false) }],
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
  addCommands() {
    return {
      setTextColor: (color) => ({ chain }) => chain().setMark(this.name, { color }).run(),
      unsetTextColor: () => ({ chain }) => chain().unsetMark(this.name).run(),
    };
  },
});

// Palette: readable on both light and dark surfaces, generic enough that no
// mark reads as a brand lift. "Default" removes the mark entirely.
const COLOR_SWATCHES = [
  { key: 'default', label: 'Default', value: null },
  { key: 'accent', label: 'Accent', value: 'var(--rk-accent)' },
  { key: 'red', label: 'Red', value: '#e5484d' },
  { key: 'orange', label: 'Orange', value: '#f76b15' },
  { key: 'green', label: 'Green', value: '#30a46c' },
  { key: 'blue', label: 'Blue', value: '#3b82f6' },
];

function ColorIcon({ swatch, ...rest }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d="M6 18 L12 5 L18 18" />
      <path d="M8.3 13.5 L15.7 13.5" />
      <rect
        x="4.5"
        y="20"
        width="15"
        height="2.4"
        rx="1.2"
        fill={swatch || 'currentColor'}
        stroke="none"
      />
    </svg>
  );
}

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
      TextColor,
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
      textColor: e.getAttributes('textColor')?.color || null,
    } : {}),
  }) || {};

  const [colorOpen, setColorOpen] = useState(false);
  const colorRef = useRef(null);
  useEffect(() => {
    if (!colorOpen) return undefined;
    const onDown = (e) => {
      if (colorRef.current && !colorRef.current.contains(e.target)) setColorOpen(false);
    };
    // Capture phase: a host may stop events from leaving the kit's layer.
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [colorOpen]);

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

  const setColor = (value) => () => {
    if (value == null) editor.chain().focus().unsetTextColor().run();
    else editor.chain().focus().setTextColor(value).run();
    setColorOpen(false);
  };

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
        <div className="rk-color-picker" ref={colorRef}>
          <button
            type="button"
            className={`rk-format-btn${colorOpen ? ' rk-format-btn-on' : ''}`}
            onMouseDown={e => e.preventDefault()}
            onClick={() => setColorOpen(v => !v)}
            aria-label={f.color || 'Text color'}
            aria-expanded={colorOpen}
            title={f.color || 'Text color'}
          >
            <ColorIcon swatch={active.textColor} />
          </button>
          {colorOpen && (
            <div className="rk-color-pop" role="menu" aria-label={f.color || 'Text color'}>
              {COLOR_SWATCHES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  role="menuitem"
                  className={`rk-color-swatch${s.value == null ? ' rk-color-swatch--default' : ''}`}
                  style={s.value ? { color: s.value } : undefined}
                  onMouseDown={e => e.preventDefault()}
                  onClick={setColor(s.value)}
                  aria-label={s.label}
                  title={s.label}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      <EditorContent editor={editor} className="rk-editor-scroll" />
    </div>
  );
}
