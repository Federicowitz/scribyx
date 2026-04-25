// --- START OF FILE src/editorUtils.ts ---
import { Mark, mergeAttributes, Extension } from '@tiptap/react';
import { Plugin, PluginKey } from 'prosemirror-state';

export const uid = () => Math.random().toString(36).substr(2, 9);

export const TodoMark = Mark.create({
  name: 'todoMark',
  addAttributes() { return { todoId: { default: null } }; },
  parseHTML() { return [{ tag: 'span[data-todo-id]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'todo-mark', 'data-todo-id': HTMLAttributes.todoId }), 0];
  }
});

export const EntityLinkMark = Mark.create({
  name: 'entityLink',
  addAttributes() { 
    return { 
      entityIds: { default: '' } // Salviamo gli ID come "id1,id2,id3"
    }; 
  },
  parseHTML() { return [{ tag: 'span[data-entity-ids]' }]; },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 
      class: 'entity-link-mark', 
      'data-entity-ids': HTMLAttributes.entityIds
    }), 0];
  }
});

// NUOVA ESTENSIONE: Generatore automatico di Block ID
export const BlockIdExtension = Extension.create({
  name: 'blockId',

  // 1. Dichiariamo che "paragraph" e "heading" possono avere un attributo "id"
  addGlobalAttributes() {
    return [
      {
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
      },
    ];
  },

  // 2. Usiamo ProseMirror per iniettare l'ID se manca
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('blockIdPlugin'),
        appendTransaction: (transactions, oldState, newState) => {
          // Se non ci sono stati cambiamenti al documento, ignora
          if (!transactions.some(tr => tr.docChanged)) return;

          const tr = newState.tr;
          let modified = false;

          // Scansiona i nodi del documento
          newState.doc.descendants((node, pos) => {
            if (node.isBlock && ['paragraph', 'heading'].includes(node.type.name)) {
              // Se il nodo non ha un ID, assegnagliene uno
              if (!node.attrs.id) {
                tr.setNodeMarkup(pos, undefined, { ...node.attrs, id: uid() });
                modified = true;
              }
            }
          });

          // Ritorna la transazione modificata solo se abbiamo aggiunto ID
          return modified ? tr : null;
        },
      }),
    ];
  },
});
// --- END OF FILE src/editorUtils.ts ---