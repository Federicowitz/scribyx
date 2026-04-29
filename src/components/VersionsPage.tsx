import React, { useState } from 'react';
import {
  AlertCircle,
  ChevronRight,
  GitBranch,
  GitCommit,
  GitPullRequest,
  PencilLine,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { Snapshot } from '../types';
import { uid } from '../editorUtils';

export function VersionsPage({
  versions,
  activeId,
  pendingVersion,
  isPendingDirty,
  onLoad,
  onBack,
  onCommit,
  onOverwrite,
  onDelete,
  onRenameBranch,
}: any) {
  const [label, setLabel] = useState('');
  const activeSnap = versions.find((version: Snapshot) => version.id === activeId);
  const isHead = versions[versions.length - 1]?.id === activeId;

  return (
    <div className="versions-page">
      <div className="versions-header">
        <button className="icon-btn" onClick={onBack}>
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="versions-title">
          <h1>Storia e Branch</h1>
          <div className="branch-pill">
            <GitBranch size={14} /> Branch Attuale: {activeSnap?.branch || pendingVersion?.branch || 'main'}
            <button
              className="icon-btn small"
              title="Rinomina branch globale"
              style={{ width: 18, height: 18, marginLeft: 6 }}
              onClick={() => onRenameBranch(activeSnap?.branch || pendingVersion?.branch || 'main')}
            >
              <PencilLine size={10} />
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="todo-input"
            placeholder="Messaggio di commit..."
            value={label}
            onChange={event => setLabel(event.target.value)}
          />
          <button
            className="btn-primary"
            style={{ width: 'auto' }}
            onClick={() => {
              if (label) {
                onCommit(label, activeSnap?.branch ?? pendingVersion?.branch ?? 'main');
                setLabel('');
              }
            }}
          >
            <GitCommit size={14} style={{ marginRight: 6 }} /> Crea Checkpoint
          </button>
          {!isHead && (
            <button
              className="btn-secondary"
              style={{ width: 'auto' }}
              onClick={() => {
                if (label) {
                  onCommit(label, `branch-${uid()}`);
                  setLabel('');
                }
              }}
            >
              <GitPullRequest size={14} style={{ marginRight: 6 }} /> Forka Flusso
            </button>
          )}
        </div>
      </div>

      <div className="versions-body">
        <div className="graph-container">
          <p className="hint" style={{ marginBottom: 20 }}>
            Clicca su un nodo per esplorare diramazioni narrative.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingLeft: 20, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 29, top: 20, bottom: 20, width: 2, background: 'var(--border)', zIndex: 0 }} />

            {pendingVersion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, zIndex: 1, position: 'relative' }}>
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: `3px solid ${isPendingDirty ? 'var(--accent-2)' : 'var(--border)'}`,
                    background: isPendingDirty ? '#fff7ed' : 'var(--editor-bg)',
                    boxShadow: isPendingDirty ? '0 0 0 4px rgba(124, 45, 18, 0.12)' : 'none',
                    transition: 'all 0.2s',
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isPendingDirty ? 'var(--accent-2)' : 'var(--text-muted)',
                      }}
                    >
                      {pendingVersion.label}
                    </div>
                    {isPendingDirty && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: 'var(--accent-2)',
                        }}
                      >
                        <AlertCircle size={11} /> Non committato
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
                    {pendingVersion.branch} • {new Date(pendingVersion.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            )}

            {versions.map((version: Snapshot, index: number) => {
              const isActive = version.id === activeId;
              const isFork = version.parentId !== (index > 0 ? versions[index - 1].id : null);

              return (
                <div
                  key={version.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    zIndex: 1,
                    position: 'relative',
                    marginLeft: isFork ? 40 : 0,
                  }}
                >
                  {isFork && (
                    <div
                      style={{
                        position: 'absolute',
                        left: -31,
                        top: '50%',
                        width: 30,
                        height: 2,
                        background: 'var(--border)',
                      }}
                    />
                  )}
                  <div
                    onClick={() => onLoad(version.id)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      cursor: 'pointer',
                      border: `3px solid ${isActive ? 'var(--accent)' : 'var(--sb-border)'}`,
                      background: isActive ? '#fff' : 'var(--editor-bg)',
                      boxShadow: isActive ? '0 0 0 4px var(--accent-light)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--text)' }}>
                      {version.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>{version.branch} • {new Date(version.timestamp).toLocaleTimeString()}</span>
                      <button
                        className="icon-btn small"
                        title="Rinomina branch"
                        style={{ width: 18, height: 18 }}
                        onClick={event => {
                          event.stopPropagation();
                          onRenameBranch(version.branch);
                        }}
                      >
                        <PencilLine size={10} />
                      </button>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className="icon-btn small"
                      title="Sovrascrivi questo commit"
                      onClick={event => {
                        event.stopPropagation();
                        onOverwrite(version.id);
                      }}
                    >
                      <RefreshCw size={12} />
                    </button>
                    <button
                      className="icon-btn small"
                      title="Elimina questo commit"
                      onClick={event => {
                        event.stopPropagation();
                        if (window.confirm(`Eliminare definitivamente il commit "${version.label}"?`)) {
                          onDelete(version.id);
                        }
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
