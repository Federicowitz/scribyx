import React, { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Trash2, Edit3, PanelLeftClose, Wrench, FileDown, FileUp, Download } from 'lucide-react';
import type { Category, Entity, Todo, Chapter, ChapterStatus } from '../types';
import { uid } from '../editorUtils';
import { ChapterPanel } from './ChapterPanel';

function Panel({ title, children, badge }: { title: string, children: React.ReactNode, badge?: number }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={`sb-panel ${open ? 'open' : ''}`}>
      <button className="sb-panel-header" onClick={() => setOpen(!open)}>
        {open ? <ChevronDown className="sb-chevron" size={14} /> : <ChevronRight className="sb-chevron" size={14} />}
        <span className="sb-panel-title">{title}</span>
        {badge !== undefined && badge > 0 && <span className="sb-badge">{badge}</span>}
      </button>
      {open && <div className="sb-panel-body panel-body">{children}</div>}
    </div>
  );
}

export function Sidebar({
  currentView, // Indica se siamo in 'editor', 'versions' o 'graph'
  onCloseSidebar, // Funzione per entrare in Focus Mode
  
  // ─── VERSIONI ─────────────────────────────
  activeVersion,
  isPendingDirty,
  onExportPdf,
  onExportProject,
  onImportProject,
  setView,

  // ─── CHAPTER SYSTEM ──────────────────────
  chapters,
  activeChapterId,
  onSelectChapter,
  onCreateChapter,
  onCommitChapter,
  onChapterStatusChange,
  onRenameChapterBranch,
  onOpenChapterHistory,

  // ─── ENTITY SYSTEM ───────────────────────
  categories,
  setCategories,
  entities,
  setEditingEntity,

  // ─── TODO ────────────────────────────────
  todos,
  onAddTodo,
  onToggleTodo,
  onRemoveTodo,
  onNavigateTodo

}: any) {
  const [utilsOpen, setUtilsOpen] = useState(false);

  return (
    <div className="sidebar">
      {/* ── LOGO E BOTTONE CHIUSURA (FOCUS MODE) ── */}
      <div className="sidebar-logo" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Edit3 className="logo-mark" size={20} />
          <span className="logo-text">Narrative.io</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
          <button
            className="icon-btn small"
            onClick={() => setUtilsOpen(open => !open)}
            title="Apri utils"
            style={{ width: '24px', height: '24px' }}
          >
            <Wrench size={14} />
          </button>
          <button 
            className="icon-btn small" 
            onClick={onCloseSidebar} 
            title="Nascondi barra laterale (Focus Mode)"
            style={{ width: '24px', height: '24px' }}
          >
            <PanelLeftClose size={16} />
          </button>
          {utilsOpen && (
            <div className="utils-menu">
              <button className="utils-menu-item" onClick={() => { setUtilsOpen(false); onExportPdf(); }}>
                <Download size={13} /> Esporta PDF
              </button>
              <button className="utils-menu-item" onClick={() => { setUtilsOpen(false); onExportProject(); }}>
                <FileDown size={13} /> Salva progetto
              </button>
              <button className="utils-menu-item" onClick={() => { setUtilsOpen(false); onImportProject(); }}>
                <FileUp size={13} /> Importa progetto
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sb-nav">

        {/* ─── CAPITOLI ───────────────────────── */}
        <Panel title="Capitoli" badge={chapters.length}>
          <ChapterPanel
            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={onSelectChapter}
            onCreateChapter={onCreateChapter}
            onCommitChapter={onCommitChapter}
            onStatusChange={onChapterStatusChange}
            onRenameBranch={onRenameChapterBranch}
            onOpenHistory={onOpenChapterHistory}
            entities={entities}
            categories={categories}
          />
        </Panel>

        {/* ─── STRUMENTI (Editor, Versioni, Grafo) ──────────────────────────────── */}
        <Panel title="Strumenti">
          <div className="version-info">
            <div className="branch-badge">
              {activeVersion?.branch || 'main'}
            </div>
            <div className="version-label">
              {isPendingDirty ? 'Pending' : (activeVersion?.label || 'Bozza')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', flexWrap: 'wrap' }}>
            <button 
              className={`btn-secondary ${currentView === 'editor' ? 'active' : ''}`} 
              style={{ flex: 1, minWidth: '45%' }} 
              onClick={() => setView('editor')}
            >
              Editor
            </button>
            <button 
              className={`btn-secondary ${currentView === 'graph' ? 'active' : ''}`} 
              style={{ flex: 1, minWidth: '45%' }} 
              onClick={() => setView('graph')}
            >
              Grafo
            </button>
            <button 
              className={`btn-secondary ${currentView === 'versions' ? 'active' : ''}`} 
              style={{ flex: 1, minWidth: '100%' }} 
              onClick={() => setView('versions')}
            >
              Versioni (Timeline)
            </button>
          </div>
        </Panel>

        {/* ─── ENTITY / CATEGORIE ───────────────────── */}
        {categories.map((cat: Category) => {
          const catEntities = entities.filter((e: Entity) => e.categoryId === cat.id);
          return (
            <Panel key={cat.id} title={cat.name} badge={catEntities.length}>
              <div className="char-list">
                {catEntities.map((e: Entity) => (
                  <div key={e.id} className="char-item" onClick={() => setEditingEntity(e)}>
                    {e.image ? (
                      <div 
                        className="char-avatar has-image" 
                        style={{ 
                          backgroundImage: `url(${e.image})`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center'
                        }} 
                      />
                    ) : (
                      <div className="char-avatar">{e.avatar}</div>
                    )}
                    <div className="char-name">{e.name}</div>
                  </div>
                ))}

                <button
                  className="btn-ghost full"
                  onClick={() =>
                    setEditingEntity({
                      id: uid(),
                      categoryId: cat.id,
                      name: '',
                      avatar: '?',
                      desc: '',
                      fields:[]
                    })
                  }
                >
                  + Aggiungi {cat.name}
                </button>
              </div>
            </Panel>
          );
        })}

        <button
          className="btn-ghost"
          style={{ margin: '10px 14px', width: 'calc(100% - 28px)' }}
          onClick={() => {
            const name = prompt("Nome nuova categoria (es. Artefatti)?");
            if (name) setCategories([...categories, { id: uid(), name, icon: 'Box' }]);
          }}
        >
          + Nuova Categoria
        </button>

        {/* ─── TODO ─────────────────────────────────── */}
        <Panel title="To-Do" badge={todos.filter((t: Todo) => !t.done).length}>
          <TodoSidebar
            todos={todos}
            onAdd={onAddTodo}
            onToggle={onToggleTodo}
            onRemove={onRemoveTodo}
            onNavigate={onNavigateTodo}
          />
        </Panel>
      </div>
    </div>
  );
}

function TodoSidebar({ todos, onAdd, onToggle, onRemove, onNavigate }: any) {
  const [val, setVal] = useState("");
  const open = todos.filter((t: Todo) => !t.done);
  const done = todos.filter((t: Todo) => t.done);

  return (
    <div>
      <div className="todo-add-row">
        <input
          className="todo-input"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="Nuovo task..."
          onKeyDown={e => e.key === 'Enter' && (onAdd(val), setVal(""))}
        />
        <button
          className="todo-add-btn"
          onClick={() => {
            if (val) {
              onAdd(val);
              setVal("");
            }
          }}
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="todo-list">
        {open.map((t: Todo) => (
          <div key={t.id} className="todo-item">
            <input
              type="checkbox"
              className="todo-check"
              checked={false}
              onChange={() => onToggle(t.id)}
            />
            <span
              className={`todo-text ${t.anchorId ? 'anchored' : ''}`}
              onClick={() => t.anchorId && onNavigate(t.anchorId)}
            >
              {t.text}
            </span>
            <button
              className="icon-btn small todo-remove"
              onClick={() => onRemove(t.id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {done.length > 0 && (
        <div className="done-section">
          <div className="done-toggle">Completati ({done.length})</div>
          <div className="todo-list" style={{ opacity: 0.6 }}>
            {done.map((t: Todo) => (
              <div key={t.id} className="todo-item done">
                <input
                  type="checkbox"
                  className="todo-check"
                  checked={true}
                  onChange={() => onToggle(t.id)}
                />
                <span className="todo-text">{t.text}</span>
                <button
                  className="icon-btn small todo-remove"
                  onClick={() => onRemove(t.id)}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
