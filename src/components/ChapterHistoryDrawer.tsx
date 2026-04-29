// components/ChapterHistoryDrawer.tsx
// Drawer che scorre da destra: mostra la storia snapshot di un capitolo,
// permette navigazione tra branch e ripristino

import React, { useState } from 'react';
import {
  X, GitCommit, GitBranch, RotateCcw, Clock,
  FileText, ChevronDown, ChevronRight, RefreshCw, Trash2
} from 'lucide-react';
import type { Chapter, ChapterSnapshot, ChapterStatus } from '../types';

const STATUS_COLORS: Record<ChapterStatus, string> = {
  draft: '#d97706',
  revised: '#2563eb',
  final: '#059669',
};

// ─── Singolo nodo nella timeline ─────────────────────────────────────────────
function SnapshotNode({
  snapshot, isActive, isHead, onRestore, onOverwrite, onDelete
}: {
  snapshot: ChapterSnapshot;
  isActive: boolean;
  isHead: boolean;
  onRestore: () => void;
  onOverwrite: () => void;
  onDelete: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const date = new Date(snapshot.timestamp);

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        position: 'relative', zIndex: 1,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Nodo cerchio */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: 16, height: 16, borderRadius: '50%', marginTop: 2,
          border: `2.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
          background: isActive ? 'var(--accent)' : 'var(--editor-bg)',
          boxShadow: isActive ? '0 0 0 3px var(--accent-light)' : 'none',
          transition: 'all 0.2s',
          cursor: 'pointer',
          flexShrink: 0,
        }} onClick={onRestore} />
      </div>

      {/* Contenuto */}
      <div style={{
        flex: 1, paddingBottom: 20,
        opacity: hovered || isActive ? 1 : 0.8,
        transition: 'opacity 0.15s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 13, fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--accent)' : 'var(--text)',
          }}>
            {snapshot.label}
          </span>
          {isHead && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '1px 5px', borderRadius: 10,
              background: 'var(--accent)', color: '#fff',
            }}>HEAD</span>
          )}
          {isActive && !isHead && (
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.07em',
              textTransform: 'uppercase', padding: '1px 5px', borderRadius: 10,
              background: 'var(--accent-light)', color: 'var(--accent)',
            }}>ATTIVO</span>
          )}
        </div>

        <div style={{ display: 'flex', align: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <Clock size={9} />
            {date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
            {' '}
            {date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 3 }}>
            <FileText size={9} />
            {snapshot.wordCount} parole
          </span>
          {snapshot.entityRefs.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>
              {snapshot.entityRefs.length} entità
            </span>
          )}
        </div>

        {/* Pulsante ripristina — appare solo su hover o se non è già attivo */}
        {hovered && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {!isActive && (
              <button
                onClick={onRestore}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '3px 8px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--editor-bg)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <RotateCcw size={10} /> Ripristina
              </button>
            )}
            {isActive && (
              <button
                onClick={onOverwrite}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 11, padding: '3px 8px', borderRadius: 4,
                  border: '1px solid var(--border)', background: 'var(--editor-bg)',
                  color: 'var(--text-muted)', cursor: 'pointer',
                  transition: 'all 0.12s',
                }}
              >
                <RefreshCw size={10} /> Sovrascrivi
              </button>
            )}
            <button
              onClick={onDelete}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 11, padding: '3px 8px', borderRadius: 4,
                border: '1px solid #fca5a5', background: '#fff5f5',
                color: 'var(--accent-2)', cursor: 'pointer',
                transition: 'all 0.12s',
              }}
            >
              <Trash2 size={10} /> Elimina
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Gruppo branch ────────────────────────────────────────────────────────────
function BranchGroup({
  branch, snapshots, activeSnapshotId, onRestore, onOverwrite, onDelete, color
}: {
  branch: string;
  snapshots: ChapterSnapshot[];
  activeSnapshotId: string | null;
  onRestore: (snap: ChapterSnapshot) => void;
  onOverwrite: (snap: ChapterSnapshot) => void;
  onDelete: (snap: ChapterSnapshot) => void;
  color: string;
}) {
  const [open, setOpen] = useState(true);
  const headSnap = snapshots[snapshots.length - 1];

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Header branch */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          width: '100%', padding: '6px 0', background: 'none', border: 'none',
          cursor: 'pointer', marginBottom: open ? 12 : 0,
        }}
      >
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', flex: 1, textAlign: 'left' }}>
          {branch}
        </span>
        <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
          {snapshots.length} commit
        </span>
        {open
          ? <ChevronDown size={12} color="var(--text-subtle)" />
          : <ChevronRight size={12} color="var(--text-subtle)" />
        }
      </button>

      {open && (
        <div style={{ position: 'relative', paddingLeft: 8 }}>
          {/* Linea verticale */}
          <div style={{
            position: 'absolute', left: 15, top: 8, bottom: 8,
            width: 1.5, background: `${color}40`,
          }} />

          {[...snapshots].reverse().map((snap, i) => (
            <SnapshotNode
              key={snap.id}
              snapshot={snap}
              isActive={snap.id === activeSnapshotId}
              isHead={i === 0}
              onRestore={() => onRestore(snap)}
              onOverwrite={() => onOverwrite(snap)}
              onDelete={() => onDelete(snap)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Drawer principale ────────────────────────────────────────────────────────
const BRANCH_COLORS = [
  '#2d5a3d', '#7c2d12', '#1e40af', '#6d28d9', '#0e7490', '#92400e'
];

export function ChapterHistoryDrawer({
  chapter, onClose, onRestore, onOverwrite, onDelete
}: {
  chapter: Chapter;
  onClose: () => void;
  onRestore: (chapterId: string, snapshot: ChapterSnapshot) => void;
  onOverwrite: (chapterId: string, snapshotId: string) => void;
  onDelete: (chapterId: string, snapshotId: string) => void;
}) {
  const branches = [...new Set(chapter.snapshots.map(s => s.branch))];

  return (
    <>
      {/* Overlay semi-trasparente */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'transparent',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 300, zIndex: 201,
        background: 'var(--sb-bg)',
        borderLeft: '1px solid var(--sb-border)',
        display: 'flex', flexDirection: 'column',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 16px 14px',
          borderBottom: '1px solid var(--sb-border)',
          display: 'flex', alignItems: 'flex-start', gap: 10,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 3 }}>
              Storia capitolo
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', fontFamily: 'var(--font-display)', lineHeight: 1.3 }}>
              {chapter.title}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 10, color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: 3 }}>
                <GitCommit size={9} /> {chapter.snapshots.length} snapshot
              </span>
              {branches.length > 1 && (
                <span style={{ fontSize: 10, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <GitBranch size={9} /> {branches.length} branch
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body scrollabile */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px' }}>
          {chapter.snapshots.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: 10, padding: '40px 20px', textAlign: 'center',
            }}>
              <GitCommit size={28} color="var(--border)" />
              <div style={{ fontSize: 13, color: 'var(--text-subtle)', lineHeight: 1.5 }}>
                Nessun checkpoint salvato.<br />
                Usa "Salva checkpoint" nel pannello capitolo.
              </div>
            </div>
          ) : (
            branches.map((branch, i) => {
              const branchSnaps = chapter.snapshots.filter(s => s.branch === branch);
              return (
                <BranchGroup
                  key={branch}
                  branch={branch}
                  snapshots={branchSnaps}
                  activeSnapshotId={chapter.activeSnapshotId}
                  onRestore={(snap) => onRestore(chapter.id, snap)}
                  onOverwrite={(snap) => onOverwrite(chapter.id, snap.id)}
                  onDelete={(snap) => {
                    if (window.confirm(`Eliminare definitivamente lo snapshot "${snap.label}"?`)) {
                      onDelete(chapter.id, snap.id);
                    }
                  }}
                  color={BRANCH_COLORS[i % BRANCH_COLORS.length]}
                />
              );
            })
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </>
  );
}
