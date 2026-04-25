import { useState, useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { X, ChevronRight, CheckCircle, Link } from 'lucide-react';

import { db } from './db';
import { uid, TodoMark, BlockIdExtension, EntityLinkMark } from './editorUtils';

import type { Todo, Category, Entity, Relation, Snapshot } from './types';

import { Sidebar } from './components/Sidebar';
import { EntityModal } from './components/EntityModal';
import { VersionsPage } from './components/VersionsPage';

import './global.css';

const DOC_ID = 'main-workspace';

export default function App() {
  const [view, setView] = useState<'editor' | 'versions'>('editor');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // -- Global State
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

  // -- UI State
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [headings, setHeadings] = useState<{ level: number; text: string; pos: number }[]>([]);

  const editor = useEditor({
    extensions: [StarterKit, TodoMark, BlockIdExtension, EntityLinkMark], // <-- Aggiunto
    content: '',
    onUpdate: ({ editor }) => {
      const newHeadings: any[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading') newHeadings.push({ level: node.attrs.level, text: node.textContent, pos, id: node.attrs.id });
      });
      setHeadings(newHeadings);
    }
  });

  // -- DB Load
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
        
        if (editor && data.content) {
          editor.commands.setContent(data.content);
        }
      }
      setIsLoaded(true);
    });
  }, [editor]);

  // -- DB Auto-Save
  useEffect(() => {
    if (!isLoaded || !editor) return;
    const timeout = setTimeout(() => {
      db.saveDocument(DOC_ID, {
        title, categories, entities, relations, todos, versions, activeVersionId,
        content: editor.getJSON()
      });
    }, 1000);
    return () => clearTimeout(timeout);
  }, [title, categories, entities, relations, todos, versions, activeVersionId, editor?.state.doc, isLoaded]);

  // -- Utils
  const navigateToPos = (pos: number) => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.view.dom.focus();
    const dom = editor.view.domAtPos(pos).node as HTMLElement;
    if (dom && dom.scrollIntoView) dom.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

  if (!isLoaded) return <div>Caricamento...</div>;

  return (
    <div className="app-layout">
      <Sidebar 
        headings={headings} navigateToPos={navigateToPos} activeVersion={versions.find(v => v.id === activeVersionId)} setView={setView}
        categories={categories} setCategories={setCategories} entities={entities} setEditingEntity={setEditingEntity}
        todos={todos} 
        onAddTodo={(text: string, anchorId?: string) => setTodos(prev => [...prev, { id: anchorId || uid(), text, done: false, anchorId }])}
        onToggleTodo={(id: string) => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t))}
        onRemoveTodo={(id: string) => setTodos(prev => prev.filter(t => t.id !== id))}
        onNavigateTodo={(todoId: string) => {
          if (!editor) return;
          let foundPos = -1;
          editor.state.doc.descendants((node, pos) => {
            if (node.marks.find(m => m.type.name === 'todoMark' && m.attrs.todoId === todoId)) foundPos = pos;
          });
          if (foundPos !== -1) navigateToPos(foundPos);
        }}
      />

      {view === 'editor' ? (
        <div className="editor-main">
          <div className="editor-area">
            <input className="doc-title-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titolo del Documento..." />
            <div className="editor-wrap">
              {editor && (
                <>
                  {/* Menu di SCRITTURA (appare quando selezioni testo) */}
                  <BubbleMenu editor={editor} className="bubble-menu" tippyOptions={{ duration: 100 }} shouldShow={({ editor, view, state, from, to }) => {
                    // Mostra solo se c'è una selezione di testo e NON siamo dentro un link
                    return from !== to && !editor.isActive('entityLink');
                  }}>
                    <EditorBubbleMenu 
                      editor={editor} categories={categories} entities={entities}
                      onAddTodo={(txt: string, id?: string) => setTodos(prev => [...prev, { id: id||uid(), text: txt, done: false, anchorId: id }])}
                      onAddRelation={(rel: Relation) => setRelations(prev => [...prev, rel])}
                    />
                  </BubbleMenu>

                  {/* Nuovo Menu di LETTURA (appare quando clicchi su un testo verde) */}
                  <BubbleMenu editor={editor} className="bm-info-menu" tippyOptions={{ duration: 100, placement: 'bottom' }} shouldShow={({ editor }) => {
                    return editor.isActive('entityLink');
                  }}>
                    <EntityInfoMenu editor={editor} entities={entities} onOpenEntity={setEditingEntity} />
                  </BubbleMenu>
                </>
              )}
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      ) : (
        <VersionsPage 
          versions={versions} activeId={activeVersionId}
          onBack={() => setView('editor')}
          onLoad={(vId: string) => {
            const snap = versions.find(v => v.id === vId);
            if (!snap || !editor) return;
            setTitle(snap.data.title);
            setCategories(snap.data.categories || []);
            setEntities(snap.data.entities || []);
            setRelations(snap.data.relations || []);
            setTodos(snap.data.todos || []);
            editor.commands.setContent(snap.data.content);
            setActiveVersionId(snap.id);
            setView('editor');
          }}
          onCommit={(label: string, branch: string) => {
            const snap: Snapshot = {
              id: uid(), parentId: activeVersionId, label, branch, timestamp: Date.now(),
              data: { title, content: editor?.getJSON(), categories, entities, relations, todos }
            };
            setVersions([...versions, snap]);
            setActiveVersionId(snap.id);
          }}
        />
      )}

      {editingEntity && <EntityModal entity={editingEntity} onSave={handleSaveEntity} onDelete={handleDeleteEntity} onClose={() => setEditingEntity(null)} />}
    </div>
  );
}

// ─── EDITOR BUBBLE MENU ───
// 4. SOSTITUISCI IL COMPONENTE EditorBubbleMenu in fondo al file
function EditorBubbleMenu({ editor, categories, entities, onAddTodo, onAddRelation }: any) {
  const [mode, setMode] = useState<'default' | 'todo' | 'link'>('default');
  const [todoText, setTodoText] = useState("");

  if (mode === 'todo') {
    return (
      <div className="bm-todo-input">
        <input autoFocus value={todoText} onChange={e => setTodoText(e.target.value)} placeholder="To-Do..."
          onKeyDown={e => {
            if (e.key === 'Enter' && todoText) {
              const tId = uid();
              editor.chain().focus().setMark('todoMark', { todoId: tId }).run();
              onAddTodo(todoText, tId);
              setMode('default');
              setTodoText("");
            }
          }} />
        <button className="icon-btn small" style={{ color: '#fff' }} onClick={() => setMode('default')}><X size={14} /></button>
      </div>
    );
  }

  if (mode === 'link') {
    return (
      <div className="bm-select-list">
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'0 4px 4px'}}>
          <span style={{fontSize: 11, color: '#fff'}}>Collega a...</span>
          <button className="icon-btn small" style={{ color: '#fff', width:20, height:20 }} onClick={() => setMode('default')}><X size={12} /></button>
        </div>
        
        {categories.map((cat: any) => {
          const catEntities = entities.filter((e: any) => e.categoryId === cat.id);
          if (catEntities.length === 0) return null;
          return (
            <div key={cat.id}>
              <div className="bm-group-title">{cat.name}</div>
              {catEntities.map((e: any) => (
                <button key={e.id} className="bm-list-item" onClick={() => {
                  const relId = uid();
                  
                  // Gestione entità multiple sullo stesso testo
                  const existingAttrs = editor.getAttributes('entityLink');
                  const currentIdsStr = existingAttrs.entityIds || '';
                  const currentIds = currentIdsStr ? currentIdsStr.split(',') : [];
                  
                  if (!currentIds.includes(e.id)) {
                    currentIds.push(e.id);
                    editor.chain().focus().setMark('entityLink', { entityIds: currentIds.join(',') }).run();
                    onAddRelation({ id: relId, sourceId: relId, targetId: e.id, type: 'mention' });
                  }
                  
                  setMode('default');
                }}>
                  {e.avatar} {e.name}
                </button>
              ))}
            </div>
          );
        })}
        {entities.length === 0 && <div style={{fontSize: 11, color:'rgba(255,255,255,0.5)', padding: 8}}>Nessuna entità creata.</div>}
      </div>
    );
  }
  

  return (
    <>
      <button onClick={() => editor.chain().focus().toggleBold().run()} className={`bm-btn ${editor.isActive('bold') ? 'active' : ''}`}>B</button>
      <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`bm-btn ${editor.isActive('italic') ? 'active' : ''}`}>I</button>
      <div className="bm-sep" />
      <button onClick={() => setMode('todo')} className="bm-btn bm-todo" title="Crea un Todo ancorato qui"><CheckCircle size={14} /> Todo</button>
      <button onClick={() => setMode('link')} className="bm-btn bm-todo" title="Collega a un Personaggio/Luogo/Ecc."><Link size={14} /> Collega</button>
    </>
  );
}

// ─── NUOVO: MENU DI LETTURA DELLE ENTITA' ───
function EntityInfoMenu({ editor, entities, onOpenEntity }: { editor: any, entities: Entity[], onOpenEntity: (e: Entity) => void }) {
  if (!editor.isActive('entityLink')) return null;

  const attrs = editor.getAttributes('entityLink');
  if (!attrs.entityIds) return null;

  // Recupera tutti gli ID salvati in questo frammento di testo
  const ids = attrs.entityIds.split(',');
  const linkedEntities = ids.map((id: string) => entities.find(e => e.id === id)).filter(Boolean) as Entity[];

  return (
    <>
      {linkedEntities.map(e => (
        <div key={e.id} className="bm-info-card" onClick={() => onOpenEntity(e)}>
          <div className="bm-info-avatar">{e.avatar}</div>
          <div className="bm-info-name">{e.name}</div>
          <ChevronRight size={14} color="var(--text-subtle)" />
        </div>
      ))}
    </>
  );
}