import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type ReactNode, type SetStateAction } from 'react';
import { Cloud, Eye, LogOut, RefreshCw, Save, Trash2, UserPlus } from 'lucide-react';
import {
  addProjectShare,
  clearIndexedDbCache,
  createCloudProject,
  deleteCloudProject,
  getProfile,
  listCloudProjects,
  listProjectShares,
  loadLocalProjectDocument,
  removeProjectShare,
  updateCloudProject,
  upsertProfile,
  type CloudProjectSummary,
  type CloudShare,
} from '../cloudRepository';
import { isSupabaseConfigured, supabase, type CloudSession } from '../supabaseClient';
import type { WritexProjectDocument } from '../types';

const appBase = import.meta.env.BASE_URL || '/';

function editorUrl(project: CloudProjectSummary) {
  const params = new URLSearchParams({
    cloudProject: project.id,
    mode: project.role === 'owner' ? 'edit' : 'view',
  });
  return `${appBase}?${params.toString()}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export function CloudPage() {
  const [session, setSession] = useState<CloudSession | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [localDocument, setLocalDocument] = useState<WritexProjectDocument | null>(null);
  const [projects, setProjects] = useState<CloudProjectSummary[]>([]);
  const [shares, setShares] = useState<Record<string, CloudShare[]>>({});
  const [shareInput, setShareInput] = useState<Record<string, string>>({});
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const user = session?.user ?? null;
  const ownedProjects = useMemo(() => projects.filter(project => project.role === 'owner'), [projects]);
  const sharedProjects = useMemo(() => projects.filter(project => project.role === 'viewer'), [projects]);

  useEffect(() => {
    loadLocalProjectDocument()
      .then(document => {
        setLocalDocument(document);
        setNewProjectTitle(document?.title ?? '');
      })
      .catch(error => setMessage(error.message));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const refreshProjects = async () => {
    if (!user) return;
    const rows = await listCloudProjects(user.id);
    setProjects(rows);
    const profile = await getProfile(user);
    setNickname(profile?.nickname ?? '');
  };

  useEffect(() => {
    if (!user) {
      setProjects([]);
      return;
    }
    refreshProjects().catch(error => setMessage(error.message));
  }, [user?.id]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Operazione fallita.');
    } finally {
      setBusy(false);
    }
  };

  const handleAuth = async (event: FormEvent, mode: 'login' | 'signup') => {
    event.preventDefault();
    const client = supabase;
    if (!client) return;

    await run(async () => {
      const credentials = { email, password };
      const result = mode === 'login'
        ? await client.auth.signInWithPassword(credentials)
        : await client.auth.signUp(credentials);
      if (result.error) throw result.error;

      if (result.data.session && result.data.user && nickname.trim()) {
        await upsertProfile(result.data.user, nickname);
      }

      setMessage(
        mode === 'login'
          ? 'Login eseguito.'
          : result.data.session
            ? 'Account creato e sessione attiva.'
            : 'Account creato. Conferma la mail, poi fai login e salva il nickname.'
      );
    });
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    await run(async () => {
      await upsertProfile(user, nickname);
      setMessage('Profilo cloud aggiornato.');
    });
  };

  const handleCreateProject = async () => {
    if (!localDocument) {
      setMessage('Non c e ancora un progetto locale da caricare.');
      return;
    }

    await run(async () => {
      await createCloudProject(newProjectTitle || localDocument.title, localDocument);
      await refreshProjects();
      setMessage('Progetto cloud creato con l ultimo stato locale.');
    });
  };

  const handleUpdateProject = async (projectId: string) => {
    if (!localDocument) {
      setMessage('Non c e ancora un progetto locale da caricare.');
      return;
    }

    await run(async () => {
      await updateCloudProject(projectId, localDocument);
      await refreshProjects();
      setMessage('Progetto cloud aggiornato con l ultimo stato locale.');
    });
  };

  const handleDeleteProject = async (project: CloudProjectSummary) => {
    const confirmed = window.confirm(
      `Eliminare definitivamente "${project.title}" dal cloud? Verranno rimossi anche i permessi di condivisione. Questa azione non tocca il progetto locale.`
    );
    if (!confirmed) return;

    await run(async () => {
      await deleteCloudProject(project.id);
      setProjects(current => current.filter(item => item.id !== project.id));
      setShares(current => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setMessage('Progetto cloud eliminato.');
    });
  };

  const handleLoadShares = async (projectId: string) => {
    await run(async () => {
      setShares(current => ({ ...current, [projectId]: [] }));
      const rows = await listProjectShares(projectId);
      setShares(current => ({ ...current, [projectId]: rows }));
    });
  };

  const handleAddShare = async (projectId: string) => {
    await run(async () => {
      await addProjectShare(projectId, shareInput[projectId] ?? '');
      setShareInput(current => ({ ...current, [projectId]: '' }));
      const rows = await listProjectShares(projectId);
      setShares(current => ({ ...current, [projectId]: rows }));
      setMessage('Permesso di lettura aggiunto.');
    });
  };

  const handleRemoveShare = async (projectId: string, shareId: string) => {
    await run(async () => {
      await removeProjectShare(shareId);
      const rows = await listProjectShares(projectId);
      setShares(current => ({ ...current, [projectId]: rows }));
    });
  };

  const handleFlushIndexedDb = async () => {
    const confirmed = window.confirm(
      'Svuotare tutto IndexedDB locale? Verranno rimossi workspace offline e cache dei progetti cloud da questo browser. I progetti su Supabase non verranno cancellati.'
    );
    if (!confirmed) return;

    await run(async () => {
      await clearIndexedDbCache();
      setLocalDocument(null);
      setNewProjectTitle('');
      setMessage('IndexedDB locale svuotato.');
    });
  };

  if (!isSupabaseConfigured) {
    return (
      <CloudShell>
        <section className="cloud-panel">
          <h1>Cloud non configurato</h1>
          <p>Imposta `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nel file `.env.local`.</p>
          <a className="cloud-link" href={appBase}>Torna all editor offline</a>
        </section>
      </CloudShell>
    );
  }

  return (
    <CloudShell>
      <section className="cloud-panel">
        <div className="cloud-topbar">
          <div>
            <h1>WriteX Cloud</h1>
            <p>Qui salvi solo l ultimo stato del progetto locale e gestisci chi puo leggerlo.</p>
          </div>
          <a className="cloud-link" href={appBase}>Editor offline</a>
        </div>

        {!user ? (
          <form className="cloud-auth" onSubmit={event => handleAuth(event, 'login')}>
            <input value={email} onChange={event => setEmail(event.target.value)} placeholder="Email" type="email" />
            <input value={password} onChange={event => setPassword(event.target.value)} placeholder="Password" type="password" />
            <input value={nickname} onChange={event => setNickname(event.target.value)} placeholder="Nickname pubblico opzionale" />
            <div className="cloud-actions">
              <button disabled={busy} type="submit">Login</button>
              <button disabled={busy} type="button" onClick={event => handleAuth(event as unknown as FormEvent, 'signup')}>
                Registrati
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="cloud-user-row">
              <div>
                <strong>{user.email}</strong>
                <span>Sessione cloud attiva</span>
              </div>
              <input value={nickname} onChange={event => setNickname(event.target.value)} placeholder="nickname" />
              <button disabled={busy} onClick={handleSaveProfile}>Salva nickname</button>
              <button disabled={busy} onClick={() => supabase?.auth.signOut()}>
                <LogOut size={14} /> Logout
              </button>
            </div>

            <div className="cloud-create-row">
              <div>
                <strong>Progetto locale</strong>
                <span>{localDocument?.title ?? 'Nessun documento locale trovato'}</span>
              </div>
              <input value={newProjectTitle} onChange={event => setNewProjectTitle(event.target.value)} placeholder="Titolo cloud" />
              <button disabled={busy || !localDocument} onClick={handleCreateProject}>
                <Cloud size={14} /> Crea cloud
              </button>
            </div>

            <ProjectList
              title="I tuoi progetti"
              projects={ownedProjects}
              busy={busy}
              shares={shares}
              shareInput={shareInput}
              onShareInput={setShareInput}
              onUpdateProject={handleUpdateProject}
              onDeleteProject={handleDeleteProject}
              onLoadShares={handleLoadShares}
              onAddShare={handleAddShare}
              onRemoveShare={handleRemoveShare}
            />

            <ProjectList
              title="Condivisi con te"
              projects={sharedProjects}
              busy={busy}
              shares={{}}
              shareInput={{}}
              onShareInput={setShareInput}
            />

            <div className="cloud-section">
              <h2>Impostazioni locali</h2>
              <p className="cloud-empty">
                IndexedDB contiene il workspace offline e le copie cache dei progetti cloud aperti da questo browser.
              </p>
              <button disabled={busy} onClick={handleFlushIndexedDb}>
                Svuota IndexedDB locale
              </button>
            </div>
          </>
        )}

        {message && <div className="cloud-message">{message}</div>}
      </section>
    </CloudShell>
  );
}

function CloudShell({ children }: { children: ReactNode }) {
  return (
    <div className="cloud-page">
      {children}
    </div>
  );
}

function ProjectList({
  title,
  projects,
  busy,
  shares,
  shareInput,
  onShareInput,
  onUpdateProject,
  onDeleteProject,
  onLoadShares,
  onAddShare,
  onRemoveShare,
}: {
  title: string;
  projects: CloudProjectSummary[];
  busy: boolean;
  shares: Record<string, CloudShare[]>;
  shareInput: Record<string, string>;
  onShareInput: Dispatch<SetStateAction<Record<string, string>>>;
  onUpdateProject?: (projectId: string) => void;
  onDeleteProject?: (project: CloudProjectSummary) => void;
  onLoadShares?: (projectId: string) => void;
  onAddShare?: (projectId: string) => void;
  onRemoveShare?: (projectId: string, shareId: string) => void;
}) {
  return (
    <div className="cloud-section">
      <h2>{title}</h2>
      {projects.length === 0 ? (
        <p className="cloud-empty">Nessun progetto.</p>
      ) : (
        <div className="cloud-project-list">
          {projects.map(project => (
            <article className="cloud-project-card" key={project.id}>
              <div>
                <h3>{project.title}</h3>
                <p>{project.role === 'owner' ? 'Owner' : 'Solo lettura'} - aggiornato {formatDate(project.updated_at)}</p>
              </div>
              <div className="cloud-project-actions">
                <a className="cloud-open-btn" href={editorUrl(project)}>
                  <Eye size={14} /> Apri
                </a>
                {project.role === 'owner' && onUpdateProject && (
                  <button disabled={busy} onClick={() => onUpdateProject(project.id)}>
                    <Save size={14} /> Aggiorna stato
                  </button>
                )}
                {project.role === 'owner' && onLoadShares && (
                  <button disabled={busy} onClick={() => onLoadShares(project.id)}>
                    <RefreshCw size={14} /> Permessi
                  </button>
                )}
                {project.role === 'owner' && onDeleteProject && (
                  <button className="danger" disabled={busy} onClick={() => onDeleteProject(project)}>
                    <Trash2 size={14} /> Elimina
                  </button>
                )}
              </div>

              {project.role === 'owner' && shares[project.id] && onAddShare && onRemoveShare && (
                <div className="cloud-shares">
                  <div className="cloud-share-input">
                    <input
                      value={shareInput[project.id] ?? ''}
                      onChange={event => onShareInput(current => ({ ...current, [project.id]: event.target.value }))}
                      placeholder="mail o nickname autorizzato"
                    />
                    <button disabled={busy} onClick={() => onAddShare(project.id)}>
                      <UserPlus size={14} /> Aggiungi view
                    </button>
                  </div>
                  {shares[project.id].map(share => (
                    <div className="cloud-share-row" key={share.id}>
                      <span>{share.identifier}</span>
                      <button disabled={busy} onClick={() => onRemoveShare(project.id, share.id)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
