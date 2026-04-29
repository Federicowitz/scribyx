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
  const versionMap = new Map(versions.map((version: Snapshot) => [version.id, version]));
  const depthMap = new Map<string, number>();
  const versionTree = versions.map((version: Snapshot) => {
    const parentVersion = version.parentId ? versionMap.get(version.parentId) ?? null : null;
    const parentDepth = version.parentId ? depthMap.get(version.parentId) ?? 0 : 0;
    const depth = parentVersion && parentVersion.branch !== version.branch
      ? parentDepth + 1
      : parentDepth;
    depthMap.set(version.id, depth);
    return {
      version,
      depth,
      isBranchStart: Boolean(parentVersion && parentVersion.branch !== version.branch),
    };
  });

  return (
    <div className="versions-page">
      <div className="versions-header">
        <button className="icon-btn" onClick={onBack}>
          <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <div className="versions-title">
          <h1>Storia e Branch</h1>
          <div className="branch-pill" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', padding: '8px 8px 8px 20px', position: 'relative' }}>

            {pendingVersion && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 1, position: 'relative', width: '100%' }}>
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
                <div style={{ minWidth: 220, maxWidth: 420 }}>
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

            {versionTree.map(({ version, depth, isBranchStart }) => {
              const isActive = version.id === activeId;
              const laneOffset = depth * 34;

              return (
                <div
                  key={version.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    zIndex: 1,
                    position: 'relative',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      width: 24 + laneOffset,
                      minWidth: 24 + laneOffset,
                      position: 'relative',
                      height: 28,
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: laneOffset + 10,
                        top: -18,
                        bottom: -18,
                        width: 1.5,
                        background: depth === 0 ? 'var(--border)' : 'rgba(45,90,61,0.18)',
                      }}
                    />
                    {isBranchStart && (
                      <div
                        style={{
                          position: 'absolute',
                          left: laneOffset - 18,
                          top: 13,
                          width: 18,
                          height: 1.5,
                          background: 'rgba(45,90,61,0.25)',
                        }}
                      />
                    )}
                    <div
                      onClick={() => onLoad(version.id)}
                      style={{
                        position: 'absolute',
                        left: laneOffset,
                        top: 4,
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
                  </div>
                  <div style={{ minWidth: 220, maxWidth: 420 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--text)', paddingTop: 2 }}>
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
                  <div style={{ display: 'flex', gap: 6, marginLeft: 'auto' }}>
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
