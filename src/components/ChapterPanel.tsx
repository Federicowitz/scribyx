// components/ChapterPanel.tsx — versione completa finale
import React, { useState } from 'react';
import {
  BookOpen, Plus, GitCommit, GitBranch,
  ChevronRight, Clock, FileText, History
} from 'lucide-react';
import type { Chapter, ChapterStatus, Entity, Category } from '../types';
import { uid } from '../editorUtils';

const STATUS_CONFIG: Record<ChapterStatus, { label: string; color: string; bg: string }> = {
  draft:   { label: 'Bozza',   color: '#92400e', bg: '#fef3c7' },
  revised: { label: 'Rivisto', color: '#1e40af', bg: '#dbeafe' },
  final:   { label: 'Finale',  color: '#065f46', bg: '#d1fae5' },
};

function StatusBadge({ status }: { status: ChapterStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
      textTransform: 'uppercase', padding: '2px 6px', borderRadius: 20,
      color: cfg.color, background: cfg.bg, flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

function MetaPill({ icon, label, accent }: { icon: React.ReactNode; label: string; accent?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 10, padding: '2px 6px', borderRadius: 20,
      background: accent ? 'var(--accent-light)' : 'rgba(0,0,0,0.05)',
      color: accent ? 'var(--accent)' : 'var(--text-muted)',
    }}>
      {icon} {label}
    </span>
  );
}

function GhostButton({
  children, onClick, style = {}
}: { children: React.ReactNode; onClick: (e: React.MouseEvent) => void; style?: React.CSSProperties }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        width: '100%', padding: '6px', fontSize: 11, borderRadius: 4,
        border: '1px solid var(--border)', color: 'var(--text-muted)',
        background: 'transparent', cursor: 'pointer', transition: 'all 0.12s',
        ...style,
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--accent)';
        el.style.color = 'var(--accent)';
        el.style.background = 'var(--accent-light)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = 'var(--border)';
        el.style.color = 'var(--text-muted)';
        el.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

function ChapterRow({
  chapter, isActive, onSelect, onCommit, onStatusChange, onOpenHistory,
}: {
  chapter: Chapter;
  isActive: boolean;
  onSelect: () => void;
  onCommit: (label: string, branch: string) => void;
  onStatusChange: (status: ChapterStatus) => void;
  onOpenHistory: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [showCommit, setShowCommit] = useState(false);

  const snapshotCount = chapter.snapshots.length;
  const branches = [...new Set(chapter.snapshots.map(s => s.branch))];
  const currentSnapshot = chapter.snapshots.find(s => s.id === chapter.activeSnapshotId);
  const wordCount = currentSnapshot?.wordCount ?? 0;
  const currentBranch = currentSnapshot?.branch ?? 'main';

  const doCommit = (branch: string) => {
    if (!commitMsg.trim()) return;
    onCommit(commitMsg.trim(), branch);
    setCommitMsg('');
    setShowCommit(false);
  };

  return (
    <div style={{
      borderRadius: 6,
      border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
      background: isActive ? 'var(--accent-light)' : 'var(--editor-bg)',
      marginBottom: 6, overflow: 'hidden',
      transition: 'border-color 0.15s, background 0.15s',
    }}>
      {/* ── Header ── */}
      <div
        onClick={() => { onSelect(); setExpanded(e => !e); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '8px 10px', cursor: 'pointer', userSelect: 'none',
        }}
      >
        <BookOpen size={13} color={isActive ? 'var(--accent)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
        <span style={{
          flex: 1, fontSize: 12.5, fontWeight: 500,
          color: isActive ? 'var(--accent)' : 'var(--text)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {chapter.title}
        </span>
        <StatusBadge status={chapter.status} />
        <ChevronRight size={13} color="var(--text-subtle)" style={{
          transform: expanded ? 'rotate(90deg)' : 'none',
          transition: 'transform 0.15s', flexShrink: 0,
        }} />
      </div>

      {/* ── Corpo espanso ── */}
      {expanded && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Metriche rapide */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <MetaPill icon={<FileText size={10} />} label={`${wordCount} parole`} />
            <MetaPill icon={<GitCommit size={10} />} label={`${snapshotCount} commit`} />
            {branches.length > 1 && (
              <MetaPill icon={<GitBranch size={10} />} label={`${branches.length} branch`} accent />
            )}
          </div>

          {/* Branch attuali */}
          {branches.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 4,
              }}>Branch</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {branches.map(branch => {
                  const branchSnaps = chapter.snapshots.filter(s => s.branch === branch);
                  const isCurrent = branch === currentBranch;
                  return (
                    <div key={branch} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '4px 6px', borderRadius: 4,
                      background: isCurrent ? 'rgba(45,90,61,0.08)' : 'transparent',
                    }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: isCurrent ? 'var(--accent)' : 'var(--border)',
                        flexShrink: 0,
                      }} />
                      <span style={{
                        flex: 1, fontSize: 11, fontFamily: 'monospace',
                        color: isCurrent ? 'var(--accent)' : 'var(--text-muted)',
                        fontWeight: isCurrent ? 600 : 400,
                      }}>
                        {branch}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--text-subtle)' }}>
                        {branchSnaps.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cambio stato */}
          <div>
            <div style={{
              fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.06em', color: 'var(--text-subtle)', marginBottom: 4,
            }}>Stato</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['draft', 'revised', 'final'] as ChapterStatus[]).map(s => {
                const cfg = STATUS_CONFIG[s];
                const active = chapter.status === s;
                return (
                  <button key={s} onClick={e => { e.stopPropagation(); onStatusChange(s); }} style={{
                    flex: 1, padding: '4px 2px', fontSize: 10, borderRadius: 4,
                    border: `1px solid ${active ? cfg.color : 'var(--border)'}`,
                    background: active ? cfg.bg : 'transparent',
                    color: active ? cfg.color : 'var(--text-muted)',
                    fontWeight: active ? 700 : 400, cursor: 'pointer',
                    transition: 'all 0.12s', textTransform: 'capitalize',
                  }}>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Commit / Fork */}
          {!showCommit ? (
            <GhostButton onClick={e => { e.stopPropagation(); setShowCommit(true); }} style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>
              <GitCommit size={11} /> Salva checkpoint
            </GhostButton>
          ) : (
            <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                autoFocus
                placeholder="Messaggio commit..."
                value={commitMsg}
                onChange={e => setCommitMsg(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') doCommit(currentBranch);
                  if (e.key === 'Escape') setShowCommit(false);
                }}
                style={{
                  border: '1px solid var(--accent)', borderRadius: 4,
                  padding: '5px 8px', fontSize: 11, outline: 'none',
                  background: 'var(--editor-bg)', color: 'var(--text)',
                  width: '100%',
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => doCommit(currentBranch)}
                  style={{
                    flex: 1, padding: '5px', fontSize: 11, borderRadius: 4,
                    background: 'var(--accent)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontWeight: 500,
                  }}
                >
                  Commit su {currentBranch}
                </button>
                <button
                  onClick={() => doCommit(`branch-${uid()}`)}
                  style={{
                    flex: 1, padding: '5px', fontSize: 11, borderRadius: 4,
                    background: 'transparent', color: 'var(--text-muted)',
                    border: '1px solid var(--border)', cursor: 'pointer',
                  }}
                  title="Crea un branch alternativo"
                >
                  ⌥ Fork
                </button>
              </div>
              <button
                onClick={() => setShowCommit(false)}
                style={{ fontSize: 10, color: 'var(--text-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                annulla
              </button>
            </div>
          )}

          {/* Cronologia */}
          {snapshotCount > 0 && (
            <GhostButton onClick={e => { e.stopPropagation(); onOpenHistory(); }}>
              <History size={11} /> Cronologia snapshot ({snapshotCount})
            </GhostButton>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pannello completo ────────────────────────────────────────────────────────
export function ChapterPanel({
  chapters, activeChapterId, onSelectChapter, onCreateChapter,
  onCommitChapter, onStatusChange, onOpenHistory, entities, categories,
}: {
  chapters: Chapter[];
  activeChapterId: string | null;
  onSelectChapter: (id: string) => void;
  onCreateChapter: () => void;
  onCommitChapter: (chapterId: string, label: string, branch: string) => void;
  onStatusChange: (chapterId: string, status: ChapterStatus) => void;
  onOpenHistory: (chapterId: string) => void;
  entities: Entity[];
  categories: Category[];
}) {
  return (
    <div style={{ padding: '8px 12px 12px' }}>
      {chapters.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--text-subtle)', padding: '4px 0 10px', lineHeight: 1.5 }}>
          Nessun capitolo ancora. Creane uno per iniziare a strutturare il tuo testo.
        </p>
      )}

      {chapters.map(chapter => (
        <ChapterRow
          key={chapter.id}
          chapter={chapter}
          isActive={chapter.id === activeChapterId}
          onSelect={() => onSelectChapter(chapter.id)}
          onCommit={(label, branch) => onCommitChapter(chapter.id, label, branch)}
          onStatusChange={status => onStatusChange(chapter.id, status)}
          onOpenHistory={() => onOpenHistory(chapter.id)}
        />
      ))}

      <button
        onClick={onCreateChapter}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          width: '100%', padding: '7px', fontSize: 12, borderRadius: 5,
          border: '1px dashed var(--border)', color: 'var(--text-muted)',
          background: 'transparent', cursor: 'pointer', marginTop: 4,
          transition: 'all 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = 'var(--accent)';
          e.currentTarget.style.color = 'var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = 'var(--border)';
          e.currentTarget.style.color = 'var(--text-muted)';
        }}
      >
        <Plus size={13} /> Nuovo capitolo
      </button>
    </div>
  );
}