import { useState, useEffect, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { X, ChevronRight, CheckCircle, Link } from 'lucide-react';

import { db } from './db';
import { uid, TodoMark, BlockIdExtension, EntityLinkMark } from './editorUtils';

import type { Todo, Category, Entity, Relation, Snapshot, FragmentLinks } from './types';

import { Sidebar } from './components/Sidebar';
import { EntityModal } from './components/EntityModal';
import { VersionsPage } from './components/VersionsPage';

import './global.css';

const DOC_ID = 'main-workspace';

export default function App() {
  const [view, setView] = useState<'editor' | 'versions'>('editor');
  const [isLoaded, setIsLoaded] = useState(false);

  const [title, setTitle] = useState("Il mio capolavoro");
  const [categories, setCategories] = useState<Category[]>([
    { id: 'cat-chars', name: 'Personaggi', icon: 'User' },
    { id: 'cat-locs', name: 'Luoghi', icon: 'Map' }
  ]);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const [activeVersionId, setActiveVersionId] = useState('');
  const [fragmentLinks, setFragmentLinks] = useState<FragmentLinks>({});

  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [headings, setHeadings] = useState<{ level: number; text: string; pos: number }[]>([]);

  // Menu info (lettura link)
  const [activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Menu "aggiungi entità" separato
  const [addMoreMenu, setAddMoreMenu] = useState<{
    linkId: string;
    excludeIds: string[];
    pos: { x: number; y: number };
  } | null>(null);

  const editorRef = useRef<any>(null);

  const editor = useEditor({
    extensions: [StarterKit, TodoMark, BlockIdExtension, EntityLinkMark],
    content: '',
    onUpdate: ({ editor }) => {
      const newHeadings: any[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading')
          newHeadings.push({ level: node.attrs.level, text: node.textContent, pos, id: node.attrs.id });
      });
      setHeadings(newHeadings);
    },
    editorProps: {
      handleClick(view, pos, event) {
        const $pos = view.state.doc.resolve(pos);
        console.log(pos);
        const marks = $pos.marks();
        const linkMark = marks.find(m => m.type.name === 'entityLink');

        if (linkMark?.attrs.linkId) {
          const target = event.target as HTMLElement;
          const rect = target.getBoundingClientRect();
          setActiveLinkId(linkMark.attrs.linkId);
          setMenuPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
          setAddMoreMenu(null); // chiudi eventuale menu aggiungi aperto
          return true;
        } else {
          setActiveLinkId(null);
          setMenuPos(null);
          setAddMoreMenu(null);
          return false;
        }
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  // DB Load
  useEffect(() => {
    db.loadDocument(DOC_ID).then(data => {
      if (data) {
        setTitle(data.title);
        if (data.categories) setCategories(data.categories);
        if (data.entities) setEntities(data.entities);
        if (data.relations) setRelations(data.relations);
        if (data.todos) setTodos(data.todos);
        if (data.versions) setVersions(data.versions);
        if (data.activeVersionId) setActiveVersionId(data.activeVersionId);
        if (data.fragmentLinks) setFragmentLinks(data.fragmentLinks);
        if (editor && data.content) editor.commands.setContent(data.content);
      }
      setIsLoaded(true);
    });
  }, [editor]);

  // DB Auto-Save
  useEffect(() => {
    if (!isLoaded || !editor) return;
    const timeout = setTimeout(() => {
      db.saveDocument(DOC_ID, {
        title, categories, entities, relations, todos,
        versions, activeVersionId, fragmentLinks,
        content: editor.getJSON()
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [title, categories, entities, relations, todos, versions, activeVersionId, fragmentLinks, editor?.state.doc, isLoaded]);

  const navigateToPos = (pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.view.dom.focus();
    const dom = editor.view.domAtPos(pos).node as HTMLElement;
    if (dom?.scrollIntoView) dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleSaveEntity = (ent: Entity) => {
    setEntities(prev => {
      const exists = prev.find(e => e.id === ent.id);
      return exists ? prev.map(e => e.id === ent.id ? ent : e) : [...prev, ent];
    });
    setEditingEntity(null);
  };

  const handleDeleteEntity = (id: string) => {
    setEntities(prev => prev.filter(e => e.id !== id));
    setEditingEntity(null);
  };

  const closeInfoMenu = () => {
    setActiveLinkId(null);
    setMenuPos(null);
    setAddMoreMenu(null);
  };

  const removeTodoMarkFromEditor = (todoId: string) => {
    if (!editor) return;

    editor.state.doc.descendants((node, pos) => {
      const hasMark = node.marks?.some(
        (m: any) => m.type.name === 'todoMark' && m.attrs.todoId === todoId
      );

      if (hasMark) {
        editor
          .chain()
          .focus()
          .setTextSelection({ from: pos, to: pos + node.nodeSize })
          .unsetMark('todoMark')
          .run();
      }
    });
  };

  if (!isLoaded) return <div>Caricamento...</div>;

  return (
    <div
      className="app-layout"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (
          !target.closest('.bm-info-menu') &&
          !target.closest('.entity-link-mark') &&
          !target.closest('.bm-add-more-menu')
        ) {
          closeInfoMenu();
        }
      }}
    >
      <Sidebar
        headings={headings} navigateToPos={navigateToPos}
        activeVersion={versions.find(v => v.id === activeVersionId)} setView={setView}
        categories={categories} setCategories={setCategories}
        entities={entities} setEditingEntity={setEditingEntity}
        todos={todos}
        onAddTodo={(text: string, anchorId?: string) =>
          setTodos(prev => [...prev, { id: anchorId || uid(), text, done: false, anchorId }])}
        onToggleTodo={(id: string) =>
          setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
        onRemoveTodo={(id: string) => {
          setTodos(prev => prev.filter(t => t.id !== id));
          removeTodoMarkFromEditor(id);
        }}
        onNavigateTodo={(todoId: string) => {
          if (!editor) return;
          let foundPos = -1;
          editor.state.doc.descendants((node, pos) => {
            if (node.marks.find((m: any) => m.type.name === 'todoMark' && m.attrs.todoId === todoId))
              foundPos = pos;
          });
          if (foundPos !== -1) navigateToPos(foundPos);
        }}
      />

      {view === 'editor' ? (
        <div className="editor-main">
          <div className="editor-area">
            <input
              className="doc-title-input" value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Titolo del Documento..."
            />
            <div className="editor-wrap">
              {editor && (
                <BubbleMenu
                  editor={editor}
                  className="bubble-menu"
                  tippyOptions={{ duration: 100 } as any}
                  shouldShow={({ from, to }) => {
                    if (from === to) return false;
                    return !editor.isActive('entityLink');
                  }}
                >
                  <EditorBubbleMenu
                    editor={editor}
                    categories={categories}
                    entities={entities}
                    fragmentLinks={fragmentLinks}
                    setFragmentLinks={setFragmentLinks}
                    onAddTodo={(txt: string, id?: string) =>
                      setTodos(prev => [...prev, { id: id || uid(), text: txt, done: false, anchorId: id }])}
                    onAddRelation={(rel: Relation) =>
                      setRelations(prev => [...prev, rel])}
                  />
                </BubbleMenu>
              )}
              <EditorContent editor={editor} />
            </div>
          </div>

          {/* Menu INFO */}
          {activeLinkId && menuPos && (
            <div
              key={activeLinkId}
              className="bm-info-menu"
              style={{
                position: 'fixed',
                left: menuPos.x,
                top: menuPos.y,
                transform: 'translateX(-50%)',
                zIndex: 1000,
              }}
              onClick={e => e.stopPropagation()}
            >
              <EntityInfoMenu
                linkId={activeLinkId}
                editor={editorRef.current}
                entities={entities}
                categories={categories}
                fragmentLinks={fragmentLinks}
                setFragmentLinks={setFragmentLinks}
                onOpenEntity={(e) => { closeInfoMenu(); setEditingEntity(e); }}
                onAddRelation={(rel: Relation) => setRelations(prev => [...prev, rel])}
                onClose={closeInfoMenu}
                onAddMore={(excludeIds) => {
                  setAddMoreMenu({
                    linkId: activeLinkId!,
                    excludeIds,
                    pos: { x: menuPos!.x, y: menuPos!.y + 10 } // leggermente sotto
                  });
                  setActiveLinkId(null);
                  setMenuPos(null);
                }}
              />
            </div>
          )}

          {/* Menu AGGIUNGI ENTITÀ */}
          {addMoreMenu && (
            <div
              className="bm-add-more-menu bm-info-menu"
              style={{
                position: 'fixed',
                left: addMoreMenu.pos.x,
                top: addMoreMenu.pos.y,
                transform: 'translateX(-50%)',
                zIndex: 1001,
              }}
              onClick={e => e.stopPropagation()}
            >
              <AddEntityMenu
                linkId={addMoreMenu.linkId}
                excludeIds={addMoreMenu.excludeIds}
                categories={categories}
                entities={entities}
                fragmentLinks={fragmentLinks}
                setFragmentLinks={setFragmentLinks}
                onAddRelation={(rel: Relation) => setRelations(prev => [...prev, rel])}
                onClose={() => setAddMoreMenu(null)}
              />
            </div>
          )}
        </div>
      ) : (
        <VersionsPage
          versions={versions} activeId={activeVersionId}
          onBack={() => setView('editor')}
          onCommit={(label: string, branch: string) => {
            const snap: Snapshot = {
              id: uid(), parentId: activeVersionId, label, branch, timestamp: Date.now(),
              data: { title, content: editor?.getJSON(), categories, entities, relations, todos, fragmentLinks }
            };
            setVersions([...versions, snap]);
            setActiveVersionId(snap.id);
          }}
          onLoad={(vId: string) => {
            const snap = versions.find(v => v.id === vId);
            if (!snap || !editor) return;
            setTitle(snap.data.title);
            setCategories(snap.data.categories || []);
            setEntities(snap.data.entities || []);
            setRelations(snap.data.relations || []);
            setTodos(snap.data.todos || []);
            setFragmentLinks(snap.data.fragmentLinks || {});
            editor.commands.setContent(snap.data.content);
            setActiveVersionId(snap.id);
            setView('editor');
          }}
        />
      )}

      {editingEntity && (
        <EntityModal
          entity={editingEntity}
          onSave={handleSaveEntity}
          onDelete={handleDeleteEntity}
          onClose={() => setEditingEntity(null)}
        />
      )}
    </div>
  );
}

// ─── MENU DI SCRITTURA ───
function EditorBubbleMenu({ editor, categories, entities, fragmentLinks, setFragmentLinks, onAddTodo, onAddRelation }: any) {
  const [mode, setMode] = useState<'default' | 'todo' | 'link'>('default');
  const [todoText, setTodoText] = useState("");

  if (mode === 'todo') {
    return (
      <div className="bm-todo-input">
        <input
          autoFocus value={todoText}
          onChange={e => setTodoText(e.target.value)}
          placeholder="To-Do..."
          onKeyDown={e => {
            if (e.key === 'Enter' && todoText) {
              const tId = uid();
              editor.chain().focus().setMark('todoMark', { todoId: tId }).run();
              onAddTodo(todoText, tId);
              setMode('default');
              setTodoText("");
            }
          }}
        />
        <button className="icon-btn small" style={{ color: '#fff' }} onClick={() => setMode('default')}>
          <X size={14} />
        </button>
      </div>
    );
  }

  if (mode === 'link') {
    return (
      <div className="bm-select-list">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 4px' }}>
          <span style={{ fontSize: 11, color: '#fff' }}>Collega a...</span>
          <button className="icon-btn small" style={{ color: '#fff', width: 20, height: 20 }} onClick={() => setMode('default')}>
            <X size={12} />
          </button>
        </div>

        {categories.map((cat: any) => {
          const catEntities = entities.filter((e: any) => e.categoryId === cat.id);
          if (catEntities.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="bm-group-title">{cat.name}</div>
              {catEntities.map((e: any) => (
                <button key={e.id} className="bm-list-item" onClick={() => {
                  const { from, to } = editor.state.selection;
                  if (from === to) return;

                  const newLinkId = uid();
                  editor.chain().focus()
                    .unsetMark('entityLink')
                    .setMark('entityLink', { linkId: newLinkId })
                    .run();

                  setFragmentLinks((prev: FragmentLinks) => ({
                    ...prev,
                    [newLinkId]: { entityIds: [e.id], todoIds: [] }
                  }));

                  onAddRelation({ id: uid(), sourceId: newLinkId, targetId: e.id, type: 'mention' });
                  setMode('default');
                }}>
                  {e.avatar} {e.name}
                </button>
              ))}
            </div>
          );
        })}

        {entities.length === 0 && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: 8 }}>
            Nessuna entità creata.
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`bm-btn ${editor.isActive('bold') ? 'active' : ''}`}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`bm-btn ${editor.isActive('italic') ? 'active' : ''}`}>I</button>
      <div className="bm-sep" />
      <button onClick={() => setMode('todo')} className="bm-btn bm-todo"><CheckCircle size={14} /> Todo</button>
      <button onClick={() => setMode('link')} className="bm-btn bm-todo"><Link size={14} /> Collega</button>
    </>
  );
}

// ─── MENU DI LETTURA ───
function EntityInfoMenu({
  linkId, editor, entities, categories, fragmentLinks, setFragmentLinks,
  onOpenEntity, onAddRelation, onClose, onAddMore
}: {
  linkId: string;
  editor: any;
  entities: Entity[];
  categories: Category[];
  fragmentLinks: FragmentLinks;
  setFragmentLinks: (fn: (prev: FragmentLinks) => FragmentLinks) => void;
  onOpenEntity: (e: Entity) => void;
  onAddRelation: (rel: Relation) => void;
  onClose: () => void;
  onAddMore: (excludeIds: string[]) => void;
}) {
  const fragment = fragmentLinks[linkId] ?? { entityIds: [], todoIds: [] };
  const linkedEntities = fragment.entityIds
    .map((id: string) => entities.find(e => e.id === id))
    .filter(Boolean) as Entity[];

  const removeEntity = (entityIdToRemove: string) => {
    const newIds = fragment.entityIds.filter((id: string) => id !== entityIdToRemove);
    if (newIds.length === 0) {
      if (editor) {
        editor.chain().focus().extendMarkRange('entityLink').unsetMark('entityLink').run();
      }
      setFragmentLinks(prev => {
        const next = { ...prev };
        delete next[linkId];
        return next;
      });
      onClose();
    } else {
      setFragmentLinks(prev => ({
        ...prev,
        [linkId]: { ...fragment, entityIds: newIds }
      }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {linkedEntities.length === 0 && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: '4px 8px' }}>
          Nessun collegamento.
        </div>
      )}
      {linkedEntities.map(e => (
        <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            className="bm-info-card"
            onClick={() => onOpenEntity(e)}
            style={{ flex: 1, margin: 0 }}
          >
            <div className="bm-info-avatar">{e.avatar}</div>
            <div className="bm-info-name">{e.name}</div>
            <ChevronRight size={14} color="var(--text-subtle)" />
          </div>
          <button
            className="icon-btn small"
            style={{
              background: 'var(--editor-bg)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)', width: '36px', height: '42px', borderRadius: '8px'
            }}
            onClick={ev => { ev.stopPropagation(); removeEntity(e.id); }}
            title="Scollega entità"
          >
            <X size={14} color="var(--text-muted)" />
          </button>
        </div>
      ))}
      <button
        className="btn-ghost"
        style={{ border: '1px solid var(--border)', boxShadow: 'var(--shadow)', padding: '6px' }}
        onClick={() => onAddMore(fragment.entityIds)}
      >
        + Collega altro
      </button>
    </div>
  );
}

// ─── MENU AGGIUNGI ENTITÀ ───
function AddEntityMenu({
  linkId, excludeIds, categories, entities, fragmentLinks, setFragmentLinks, onAddRelation, onClose
}: {
  linkId: string;
  excludeIds: string[];
  categories: Category[];
  entities: Entity[];
  fragmentLinks: FragmentLinks;
  setFragmentLinks: (fn: (prev: FragmentLinks) => FragmentLinks) => void;
  onAddRelation: (rel: Relation) => void;
  onClose: () => void;
}) {
  const available = entities.filter(e => !excludeIds.includes(e.id));

  return (
    <div className="bm-select-list" style={{ minWidth: 180 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px 4px' }}>
        <span style={{ fontSize: 11, color: '#fff' }}>Collega altro...</span>
        <button className="icon-btn small" style={{ color: '#fff', width: 20, height: 20 }} onClick={onClose}>
          <X size={12} />
        </button>
      </div>

      {categories.map((cat: any) => {
        const catEntities = entities.filter((e: any) =>
          e.categoryId === cat.id && !excludeIds.includes(e.id)
        );
        if (catEntities.length === 0) return null;
        return (
          <div key={cat.id}>
            <div className="bm-group-title">{cat.name}</div>
            {catEntities.map((e: any) => (
              <button key={e.id} className="bm-list-item" onClick={() => {
                setFragmentLinks(prev => ({
                  ...prev,
                  [linkId]: {
                    ...prev[linkId],
                    entityIds: [...(prev[linkId]?.entityIds || []), e.id]
                  }
                }));
                onAddRelation({ id: uid(), sourceId: linkId, targetId: e.id, type: 'mention' });
                onClose();
              }}>
                {e.avatar} {e.name}
              </button>
            ))}
          </div>
        );
      })}

      {available.length === 0 && (
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', padding: 8 }}>
          Tutte le entità sono già collegate.
        </div>
      )}
    </div>
  );
}

