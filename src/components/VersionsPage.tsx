import React, { useState } from 'react';
import { ChevronRight, GitBranch, GitCommit, GitPullRequest } from 'lucide-react';
import type { Snapshot } from '../types';
import { uid } from '../editorUtils';

export function VersionsPage({ versions, activeId, onLoad, onBack, onCommit }: any) {
  const [label, setLabel] = useState("");
  const activeSnap = versions.find((v: Snapshot) => v.id === activeId);
  const isHead = versions[versions.length - 1]?.id === activeId;

  return (
    <div className="versions-page">
      <div className="versions-header">
        <button className="icon-btn" onClick={onBack}><ChevronRight size={20} style={{transform: 'rotate(180deg)'}} /></button>
        <div className="versions-title">
          <h1>Storia e Branch</h1>
          <div className="branch-pill"><GitBranch size={14} /> Branch Attuale: {activeSnap?.branch || 'main'}</div>
        </div>
        <div style={{display:'flex', gap: 10}}>
          <input className="todo-input" placeholder="Messaggio di commit..." value={label} onChange={e => setLabel(e.target.value)} />
          <button className="btn-primary" style={{width:'auto'}} onClick={() => { if (label) { onCommit(label, activeSnap?.branch ?? 'main'); setLabel(""); } }}>
            <GitCommit size={14} style={{marginRight: 6}} /> Crea Checkpoint
          </button>
          {!isHead && (
            <button className="btn-secondary" style={{width:'auto'}} onClick={() => { if(label) { onCommit(label, `branch-${uid()}`); setLabel(""); } }}>
              <GitPullRequest size={14} style={{marginRight: 6}} /> Forka Flusso
            </button>
          )}
        </div>
      </div>

      <div className="versions-body">
        <div className="graph-container">
          <p className="hint" style={{marginBottom: 20}}>Clicca su un nodo per esplorare diramazioni narrative.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', paddingLeft: 20, position: 'relative' }}>
            <div style={{ position: 'absolute', left: 29, top: 20, bottom: 20, width: 2, background: 'var(--border)', zIndex: 0 }} />
            {versions.map((v: Snapshot, i: number) => {
              const isActive = v.id === activeId;
              const isFork = v.parentId !== (i > 0 ? versions[i-1].id : null);
              return (
                <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 20, zIndex: 1, position: 'relative', marginLeft: isFork ? 40 : 0 }}>
                  {isFork && <div style={{ position: 'absolute', left: -31, top: '50%', width: 30, height: 2, background: 'var(--border)' }} />}
                  <div onClick={() => onLoad(v.id)} style={{
                      width: 20, height: 20, borderRadius: '50%', cursor: 'pointer',
                      border: `3px solid ${isActive ? 'var(--accent)' : 'var(--sb-border)'}`,
                      background: isActive ? '#fff' : 'var(--editor-bg)',
                      boxShadow: isActive ? '0 0 0 4px var(--accent-light)' : 'none',
                      transition: 'all 0.2s'
                    }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: isActive ? 'var(--accent)' : 'var(--text)' }}>{v.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>{v.branch} • {new Date(v.timestamp).toLocaleTimeString()}</div>
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