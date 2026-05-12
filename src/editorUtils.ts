import { Mark, mergeAttributes, Extension } from '@tiptap/react';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export const uid = () => Math.random().toString(36).substr(2, 9);

export const TodoMark = Mark.create({
  name: 'todoMark',
  addAttributes() { return { todoId: { default: null } }; },
  parseHTML() { 
    return [{ 
      tag: 'span[data-todo-id]',
      getAttrs: dom => {
        if (typeof dom === 'string') return {};
        return { todoId: dom.getAttribute('data-todo-id') };
      }
    }]; 
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      class: 'todo-mark', 
      'data-todo-id': HTMLAttributes.todoId 
    }), 0];
  }
});

export const EntityLinkMark = Mark.create({
  name: 'entityLink',
  inclusive: false,
  spanning: false,

  // Questo è il punto critico: mark con linkId DIVERSI sono istanze diverse
  // e NON devono mai essere considerati uguali da ProseMirror
  addAttributes() { 
    return { 
      linkId: { 
        default: null,
        // Forza ProseMirror a trattare ogni linkId come unico
        parseHTML: el => (el as HTMLElement).getAttribute('data-link-id'),
        renderHTML: attrs => ({ 'data-link-id': attrs.linkId }),
      },
    }; 
  },

  parseHTML() { 
    return [{ tag: 'span[data-link-id]' }]; 
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      class: 'entity-link-mark',
    }), 0];
  }
});

export const UnderlineMark = Mark.create({
  name: 'underline',

  parseHTML() {
    return [
      { tag: 'u' },
      {
        style: 'text-decoration',
        getAttrs: value => String(value).includes('underline') && null,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { style: 'text-decoration: underline;' }), 0];
  },
});

export const TextStyleMark = Mark.create({
  name: 'textStyle',

  addAttributes() {
    return {
      fontFamily: {
        default: null,
        parseHTML: element => (element as HTMLElement).style.fontFamily || null,
      },
      fontSize: {
        default: null,
        parseHTML: element => (element as HTMLElement).style.fontSize || null,
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[style]' }];
  },

  renderHTML({ HTMLAttributes }) {
    const style = [
      HTMLAttributes.fontFamily ? `font-family: ${HTMLAttributes.fontFamily}` : '',
      HTMLAttributes.fontSize ? `font-size: ${HTMLAttributes.fontSize}` : '',
    ].filter(Boolean).join('; ');

    if (!style) return ['span', HTMLAttributes, 0];
    return ['span', mergeAttributes(HTMLAttributes, { style }), 0];
  },
});

export const ParagraphFormatExtension = Extension.create({
  name: 'paragraphFormat',

  addGlobalAttributes() {
    return [{
      types: ['heading', 'paragraph'],
      attributes: {
        textAlign: {
          default: null,
          parseHTML: element => (element as HTMLElement).style.textAlign || null,
          renderHTML: attributes => {
            const styles = [
              attributes.textAlign ? `text-align: ${attributes.textAlign}` : '',
              attributes.lineHeight ? `line-height: ${attributes.lineHeight}` : '',
              attributes.paragraphSpacing ? `margin-bottom: ${attributes.paragraphSpacing}` : '',
            ].filter(Boolean).join('; ');
            return styles ? { style: styles } : {};
          },
        },
        lineHeight: {
          default: null,
          parseHTML: element => (element as HTMLElement).style.lineHeight || null,
          renderHTML: () => ({}),
        },
        paragraphSpacing: {
          default: null,
          parseHTML: element => (element as HTMLElement).style.marginBottom || null,
          renderHTML: () => ({}),
        },
      },
    }];
  },
});

export const BlockIdExtension = Extension.create({
  name: 'blockId',

  addGlobalAttributes() {
    return [{
      types: ['heading', 'paragraph'],
      attributes: {
        id: {
          default: null,
          parseHTML: element => element.getAttribute('data-id'),
          renderHTML: attributes => {
            if (!attributes.id) return {};
            return { 'data-id': attributes.id };
          },
        },
      },
    }];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockIdPlugin'),
        appendTransaction: (transactions, oldState, newState) => {
          if (!transactions.some(tr => tr.docChanged)) return null;

          const tr = newState.tr;
          let modified = false;

          newState.doc.descendants((node, pos) => {
            if (node.isBlock && ['paragraph', 'heading'].includes(node.type.name)) {
              if (!node.attrs.id) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: uid() });
                modified = true;
              }
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});

export const ChapterPageExtension = Extension.create({
  name: 'chapterPages',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('chapterPagesPlugin'),
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            const groups: Array<Array<{ from: number; to: number }>> = [];
            let currentGroup: Array<{ from: number; to: number }> = [];

            state.doc.forEach((node, pos) => {
              const isChapterStart = node.type.name === 'heading' && node.attrs?.level === 1;
              if (isChapterStart && currentGroup.length > 0) {
                groups.push(currentGroup);
                currentGroup = [];
              }

              currentGroup.push({ from: pos, to: pos + node.nodeSize });
            });

            if (currentGroup.length > 0) {
              groups.push(currentGroup);
            }

            groups.forEach(group => {
              group.forEach((entry, index) => {
                const classes = ['chapter-page-node'];
                if (index === 0) {
                  classes.push('chapter-page-start');
                }
                if (index === group.length - 1) {
                  classes.push('chapter-page-end');
                }
                if (group.length === 1) {
                  classes.push('chapter-page-single');
                }

                decorations.push(
                  Decoration.node(entry.from, entry.to, {
                    class: classes.join(' '),
                  })
                );
              });
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
