import type { Editor } from '@tiptap/react';
import type React from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  Underline,
} from 'lucide-react';

const FONT_OPTIONS = [
  { label: 'Lora', value: 'Lora, Georgia, serif' },
  { label: 'Serif', value: 'Georgia, serif' },
  { label: 'Sans', value: 'DM Sans, system-ui, sans-serif' },
  { label: 'Mono', value: 'ui-monospace, Consolas, monospace' },
];

const FONT_SIZES = ['13px', '15px', '16.5px', '18px', '21px', '24px', '30px'];

type Alignment = 'left' | 'center' | 'right' | 'justify';

function applyBlockAttributes(editor: Editor, attrs: Record<string, string>) {
  editor.chain().focus().updateAttributes('paragraph', attrs).updateAttributes('heading', attrs).run();
}

function ToolbarButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`editor-tool-btn ${active ? 'active' : ''}`}
      title={title}
      onMouseDown={event => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function EditorToolbar({ editor, mobileOpen = false }: { editor: Editor; mobileOpen?: boolean }) {
  const currentFont = (editor.getAttributes('textStyle').fontFamily as string | undefined) ?? FONT_OPTIONS[0].value;
  const currentSize = (editor.getAttributes('textStyle').fontSize as string | undefined) ?? '16.5px';
  const currentBlock = editor.getAttributes('paragraph').textAlign
    ? editor.getAttributes('paragraph')
    : editor.getAttributes('heading');

  const setFont = (fontFamily: string) => {
    editor.chain().focus().setMark('textStyle', { fontFamily }).run();
  };

  const setFontSize = (fontSize: string) => {
    editor.chain().focus().setMark('textStyle', { fontSize }).run();
  };

  const setAlignment = (textAlign: Alignment) => {
    applyBlockAttributes(editor, { textAlign });
  };

  return (
    <div className={`editor-toolbar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Strumenti di formattazione">
      <div className="editor-tool-group">
        <select
          className="editor-tool-select wide"
          value={currentFont}
          title="Font"
          onMouseDown={event => event.stopPropagation()}
          onChange={event => setFont(event.target.value)}
        >
          {FONT_OPTIONS.map(font => (
            <option key={font.value} value={font.value}>{font.label}</option>
          ))}
        </select>
        <select
          className="editor-tool-select"
          value={currentSize}
          title="Dimensione"
          onMouseDown={event => event.stopPropagation()}
          onChange={event => setFontSize(event.target.value)}
        >
          {FONT_SIZES.map(size => (
            <option key={size} value={size}>{size.replace('px', '')}</option>
          ))}
        </select>
      </div>

      <div className="editor-tool-group">
        <ToolbarButton active={editor.isActive('bold')} title="Grassetto" onClick={() => editor.chain().focus().toggleBold().run()}>
          <Bold size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('italic')} title="Corsivo" onClick={() => editor.chain().focus().toggleItalic().run()}>
          <Italic size={15} />
        </ToolbarButton>
        <ToolbarButton active={editor.isActive('underline')} title="Sottolineato" onClick={() => editor.chain().focus().toggleMark('underline').run()}>
          <Underline size={15} />
        </ToolbarButton>
      </div>

      <div className="editor-tool-group">
        <ToolbarButton active={currentBlock.textAlign === 'left' || !currentBlock.textAlign} title="Allinea a sinistra" onClick={() => setAlignment('left')}>
          <AlignLeft size={15} />
        </ToolbarButton>
        <ToolbarButton active={currentBlock.textAlign === 'center'} title="Centra" onClick={() => setAlignment('center')}>
          <AlignCenter size={15} />
        </ToolbarButton>
        <ToolbarButton active={currentBlock.textAlign === 'right'} title="Allinea a destra" onClick={() => setAlignment('right')}>
          <AlignRight size={15} />
        </ToolbarButton>
        <ToolbarButton active={currentBlock.textAlign === 'justify'} title="Giustifica" onClick={() => setAlignment('justify')}>
          <AlignJustify size={15} />
        </ToolbarButton>
      </div>
    </div>
  );
}
