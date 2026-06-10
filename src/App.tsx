import { useState, useEffect, useRef, type ChangeEvent, type CSSProperties } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import { X, ChevronRight, CheckCircle, Link, PanelLeft, Moon, Sun, Eye, Pencil, SlidersHorizontal } from 'lucide-react';

import { db } from './db';
import {
  uid,
  TodoMark,
  BlockIdExtension,
  ChapterPageExtension,
  EntityLinkMark,
  UnderlineMark,
  TextStyleMark,
  ParagraphFormatExtension,
} from './editorUtils';

import type { Todo, Category, Entity, Relation, Snapshot, FragmentLinks, GraphSnapshot, GraphMap } from './types';

import { Sidebar } from './components/Sidebar';
import { EntityModal } from './components/EntityModal';
import { VersionsPage } from './components/VersionsPage';
import { syncChaptersFromDoc, createChapterSnapshot, overwriteChapterSnapshot, restoreChapterSnapshot } from './chapterUtils';
import { ChapterHistoryDrawer } from './components/ChapterHistoryDrawer';
import type { Chapter, ChapterSnapshot, ChapterStatus } from './types';
import { GraphView } from './components/GraphView';
import { EditorToolbar } from './components/EditorToolbar';
import { getCloudProject, getCloudProjectMetadata, getCurrentUser, loadCachedCloudProject, saveCachedCloudProject, type CloudRole } from './cloudRepository';
import { THEME_PRESETS, UI_THEME_STORAGE_KEY, readThemePreference, type UiThemeMode } from './theme';
import './global.css';

const DOC_ID = 'main-workspace';
const PENDING_VERSION_ID = '__pending__';
const PROJECT_FILE_EXTENSION = '.writexproj';
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat-chars', name: 'Personaggi', icon: 'User' },
  { id: 'cat-locs', name: 'Luoghi', icon: 'Map' },
  { id: 'cat-objs', name: 'Oggetti', icon: 'Box' },
  { id: 'cat-groups', name: 'Gruppi', icon: 'Users' }
];
const DEFAULT_GRAPH_MAP_ID = 'graph-map-main';
const DEFAULT_GRAPH_MAP: GraphMap = {
  id: DEFAULT_GRAPH_MAP_ID,
  label: 'Mappa principale',
  order: 0,
  createdAt: Date.now(),
};
const MOBILE_LAYOUT_QUERY = '(max-width: 720px)';

function buildChapterVersionMap(chapters: Chapter[]) {
  const chapterVersions: Record<string, string> = {};
  chapters.forEach(chapter => {
    if (chapter.activeSnapshotId) {
      chapterVersions[chapter.id] = chapter.activeSnapshotId;
    }
  });
  return chapterVersions;
}

function normalizeFragmentLinks(links: FragmentLinks = {}) {
  return Object.fromEntries(
    Object.entries(links)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([linkId, fragment]) => [
        linkId,
        {
          entityIds: [...(fragment.entityIds ?? [])].sort(),
          todoIds: [...(fragment.todoIds ?? [])].sort(),
          graphSnapshotIds: [...(fragment.graphSnapshotIds ?? [])].sort(),
        },
      ])
  );
}

function normalizeChapterVersions(chapterVersions: Record<string, string> = {}) {
  return Object.fromEntries(
    Object.entries(chapterVersions).sort(([left], [right]) => left.localeCompare(right))
  );
}

export default function App() {
  const [view, setView] = useState<'editor' | 'versions' | 'graph'>('editor');
  const [mainSidebarOpen, setMainSidebarOpen] = useState(true); // Stato per il Full Screen
  const [isLoaded, setIsLoaded] = useState(false);
  const [cloudContext, setCloudContext] = useState<{ projectId: string; title: string; role: CloudRole } | null>(null);
  const [cloudLoadError, setCloudLoadError] = useState('');

  const [title, setTitle] = useState("Il mio capolavoro");
  const[categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [entities, setEntities] = useState<Entity[]>([]);
  const[relations, setRelations] = useState<Relation[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [versions, setVersions] = useState<Snapshot[]>([]);
  const[activeVersionId, setActiveVersionId] = useState('');
  const [pendingUpdatedAt, setPendingUpdatedAt] = useState(Date.now());
  const [pendingBaseVersionId, setPendingBaseVersionId] = useState<string | null>(null);
  const [fragmentLinks, setFragmentLinks] = useState<FragmentLinks>({});
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [headings, setHeadings] = useState<{ level: number; text: string; pos: number }[]>([]);

  //Roba che serve per sincronizzare i capitoli
  const[chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [historyDrawerChapterId, setHistoryDrawerChapterId] = useState<string | null>(null);

  // Graph snapshots
  const [graphMaps, setGraphMaps] = useState<GraphMap[]>([DEFAULT_GRAPH_MAP]);
  const [activeGraphMapId, setActiveGraphMapId] = useState<string>(DEFAULT_GRAPH_MAP_ID);
  const [graphSnapshots, setGraphSnapshots] = useState<GraphSnapshot[]>([]);
  const [activeGraphId, setActiveGraphId] = useState<string | null>(null);
  const [graphNavigationContext, setGraphNavigationContext] = useState<{ linkId: string; snapshotLabel: string } | null>(null);

  // Menu info (lettura link)
  const[activeLinkId, setActiveLinkId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

  // Menu "aggiungi entità" separato
  const [addMoreMenu, setAddMoreMenu] = useState<{
    linkId: string;
    excludeIds: string[];
    pos: { x: number; y: number };
  } | null>(null);
  const [themeMode, setThemeMode] = useState<UiThemeMode>(readThemePreference);
  const [brightnessPanelOpen, setBrightnessPanelOpen] = useState(false);
  const [formattingPanelOpen, setFormattingPanelOpen] = useState(false);
  const [ownerMode, setOwnerMode] = useState<'read' | 'edit'>(() => {
    const urlMode = new URLSearchParams(window.location.search).get('mode');
    return urlMode === 'view' ? 'read' : 'edit';
  });
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const editorRef = useRef<any>(null);
  const isReadOnlyRef = useRef(false);
  const importProjectInputRef = useRef<HTMLInputElement | null>(null);
  const selectedTheme = THEME_PRESETS[themeMode];
  const cloudProjectId = new URLSearchParams(window.location.search).get('cloudProject');
  const canToggleReadMode = cloudContext?.role !== 'viewer';
  const isReadOnly = cloudContext?.role === 'viewer' || (canToggleReadMode && ownerMode === 'read');

  const buildWorkspaceData = () => ({
    title,
    content: editor?.getJSON() ?? '',
    categories,
    entities,
    relations,
    todos,
    fragmentLinks,
    chapterVersions: buildChapterVersionMap(chapters),
  });

  const buildPersistedDocumentData = () => ({
    title,
    categories,
    entities,
    relations,
    todos,
    versions,
    activeVersionId,
    pendingUpdatedAt,
    pendingBaseVersionId,
    fragmentLinks,
    content: editor?.getJSON() ?? '',
    chapters,
    graphMaps,
    activeGraphMapId,
    graphSnapshots,
    activeGraphId,
  });

  const resolveFragmentLinks = (
    snapshotData: Snapshot['data'],
    chapterState: Chapter[]
  ) => {
    if (snapshotData.fragmentLinks) {
      return snapshotData.fragmentLinks;
    }

    const merged: FragmentLinks = {};
    if (!snapshotData.chapterVersions) {
      return merged;
    }

    chapterState.forEach(chapter => {
      const snapshotId = snapshotData.chapterVersions?.[chapter.id];
      const chapterSnapshot = chapter.snapshots.find(s => s.id === snapshotId);
      if (chapterSnapshot?.fragmentLinks) {
        Object.assign(merged, chapterSnapshot.fragmentLinks);
      }
    });

    return merged;
  };

  const serializeWorkspaceData = (data: ReturnType<typeof buildWorkspaceData>) =>
    JSON.stringify({
      ...data,
      fragmentLinks: normalizeFragmentLinks(data.fragmentLinks),
      chapterVersions: normalizeChapterVersions(data.chapterVersions),
    });

  const hasWorkspaceContent = (data: ReturnType<typeof buildWorkspaceData>) =>
    Boolean(
      data.title.trim() ||
      JSON.stringify(data.content) !== '""' ||
      data.entities.length ||
      data.relations.length ||
      data.todos.length ||
      data.categories.length ||
      Object.keys(data.fragmentLinks).length ||
      chapters.length
    );

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyleMark,
      UnderlineMark,
      ParagraphFormatExtension,
      TodoMark,
      BlockIdExtension,
      ChapterPageExtension,
      EntityLinkMark,
    ],
    content: '',
    onUpdate: ({ editor }) => {
      const newHeadings: any[] =[];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading')
          newHeadings.push({ level: node.attrs.level, text: node.textContent, pos, id: node.attrs.id });
      });
      setHeadings(newHeadings);
    },
    editorProps: {
      handleClick(view, pos, event) {
        const $pos = view.state.doc.resolve(pos);
        const marks = $pos.marks();
        const linkMark = marks.find(m => m.type.name === 'entityLink');

        if (linkMark?.attrs.linkId) {
          const target = event.target as HTMLElement;
          const rect = target.getBoundingClientRect();
          setActiveLinkId(linkMark.attrs.linkId);
          setMenuPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
          setAddMoreMenu(null); 
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

  useEffect(() => {
    isReadOnlyRef.current = isReadOnly;
  }, [isReadOnly]);

  useEffect(() => {
    editor?.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  useEffect(() => {
    if (isReadOnly && view === 'versions') {
      setView('editor');
    }
  }, [isReadOnly, view]);

  useEffect(() => {
    window.localStorage.setItem(UI_THEME_STORAGE_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const updateKeyboardOffset = () => {
      const viewport = window.visualViewport;
      if (!viewport) {
        setKeyboardOffset(0);
        return;
      }

      const coveredHeight = window.innerHeight - viewport.height - viewport.offsetTop;
      setKeyboardOffset(Math.max(0, Math.round(coveredHeight)));
    };

    updateKeyboardOffset();
    window.visualViewport?.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport?.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('resize', updateKeyboardOffset);

    return () => {
      window.visualViewport?.removeEventListener('resize', updateKeyboardOffset);
      window.visualViewport?.removeEventListener('scroll', updateKeyboardOffset);
      window.removeEventListener('resize', updateKeyboardOffset);
    };
  }, []);

  const applyDocument = (data: any) => {
    if (data) {
      setTitle(data.title);
      if (data.categories) setCategories(data.categories);
      if (data.entities) setEntities(data.entities);
      if (data.relations) setRelations(data.relations);
      if (data.todos) setTodos(data.todos);
      if (data.versions) setVersions(data.versions);
      if (data.activeVersionId) setActiveVersionId(data.activeVersionId);
      if (data.pendingUpdatedAt) setPendingUpdatedAt(data.pendingUpdatedAt);
      if (data.pendingBaseVersionId !== undefined) setPendingBaseVersionId(data.pendingBaseVersionId);
      if (data.fragmentLinks) setFragmentLinks(data.fragmentLinks);
      if (editor && data.content) editor.commands.setContent(data.content);
      if (data.chapters) setChapters(data.chapters);
      if (data.graphMaps) setGraphMaps(data.graphMaps);
      if (data.activeGraphMapId) setActiveGraphMapId(data.activeGraphMapId);
      if (data.graphSnapshots) {
        setGraphSnapshots(
          data.graphSnapshots.map((snapshot: GraphSnapshot) => ({
            ...snapshot,
            mapId: snapshot.mapId ?? data.activeGraphMapId ?? DEFAULT_GRAPH_MAP_ID,
          }))
        );
      }
      if (data.activeGraphId) setActiveGraphId(data.activeGraphId);
    }
  };

  useEffect(() => {
    if (!editor) return;
    const handleAgentDocumentSaved = (event: Event) => {
      if (isReadOnlyRef.current) return;
      applyDocument((event as CustomEvent).detail);
      setIsLoaded(true);
    };

    window.addEventListener('writex-agent-document-saved', handleAgentDocumentSaved);
    if (cloudProjectId) {
      Promise.resolve()
        .then(async () => {
          const user = await getCurrentUser();
          if (!user) throw new Error('Fai login dalla pagina cloud prima di aprire questo progetto.');
          const cached = await loadCachedCloudProject(cloudProjectId);
          const metadata = await getCloudProjectMetadata(cloudProjectId, user.id);
          const metadataRole = metadata.role as CloudRole;

          if (cached?.remoteUpdatedAt === metadata.updated_at) {
            applyDocument(cached.document);
            setCloudContext({
              projectId: cached.cloudProjectId,
              title: metadata.title,
              role: metadataRole,
            });
            setIsLoaded(true);
            return;
          }

          const project = await getCloudProject(cloudProjectId, user.id);
          applyDocument(project.document);
          setCloudContext({ projectId: project.id, title: project.title, role: project.role as CloudRole });
          await saveCachedCloudProject({
            projectId: project.id,
            title: project.title,
            role: project.role as CloudRole,
            remoteUpdatedAt: project.updated_at,
            document: project.document,
          });
          setIsLoaded(true);
        })
        .catch(async error => {
          const cached = await loadCachedCloudProject(cloudProjectId);
          if (cached) {
            applyDocument(cached.document);
            setCloudContext({
              projectId: cached.cloudProjectId,
              title: cached.title,
              role: cached.role,
            });
            setIsLoaded(true);
            return;
          }
          setCloudLoadError(error instanceof Error ? error.message : 'Impossibile caricare il progetto cloud.');
          setIsLoaded(true);
        });
    } else {
      db.loadDocument(DOC_ID).then(data => {
        applyDocument(data);
        setIsLoaded(true);
      });
    }

    return () => {
      window.removeEventListener('writex-agent-document-saved', handleAgentDocumentSaved);
    };
  }, [editor, cloudProjectId]);

  useEffect(() => {
    if (!isLoaded || !editor || isReadOnly) return;
    const timeout = setTimeout(() => setPendingUpdatedAt(Date.now()), 250);
    return () => clearTimeout(timeout);
  }, [title, categories, entities, relations, todos, fragmentLinks, chapters, editor?.state.doc, isLoaded, isReadOnly]);

  useEffect(() => {
    if (!isLoaded || !editor || isReadOnly) return;
    const timeout = setTimeout(() => {
      db.saveDocument(DOC_ID, buildPersistedDocumentData());
    }, 1000);
    return () => clearTimeout(timeout);
  },[title, categories, entities, relations, todos, versions, activeVersionId, pendingUpdatedAt, pendingBaseVersionId, fragmentLinks, chapters, editor?.state.doc, isLoaded, graphMaps, activeGraphMapId, graphSnapshots, activeGraphId, isReadOnly]);

  useEffect(() => {
    if (!editor || !isLoaded) return;
    const doc = editor.getJSON();
    setChapters(prev => syncChaptersFromDoc(doc, prev, fragmentLinks));
  },[editor?.state.doc, fragmentLinks, isLoaded]);

  const activeVersion = versions.find(version => version.id === activeVersionId) ?? null;
  const currentWorkspaceData = buildWorkspaceData();
  const isPendingDirty = activeVersion
    ? serializeWorkspaceData(activeVersion.data as ReturnType<typeof buildWorkspaceData>) !== serializeWorkspaceData(currentWorkspaceData)
    : hasWorkspaceContent(currentWorkspaceData);

  const commitActiveChapterSnapshots = (chapterState: Chapter[]) => {
    if (!editor) return chapterState;
    const doc = editor.getJSON();

    return chapterState.map(chapter => {
      const activeSnapshot = chapter.snapshots.find(snapshot => snapshot.id === chapter.activeSnapshotId);
      if (!activeSnapshot) {
        return chapter;
      }

      return {
        ...chapter,
        snapshots: chapter.snapshots.map(snapshot =>
          snapshot.id === activeSnapshot.id
            ? overwriteChapterSnapshot(snapshot, chapter, doc, fragmentLinks)
            : snapshot
        ),
      };
    });
  };

  const handleCommitGlobal = (label: string, branch: string = activeVersion?.branch ?? 'main') => {
    if (isReadOnly) return;
    const snap: Snapshot = {
      id: uid(),
      parentId: activeVersionId || null,
      label,
      branch,
      timestamp: Date.now(),
      data: buildWorkspaceData(),
    };
    setVersions(prev => [...prev, snap]);
    setActiveVersionId(snap.id);
    setPendingBaseVersionId(snap.id);
    setPendingUpdatedAt(Date.now());
  };

  const handleCreateChapter = () => {
    if (isReadOnly) return;
    const title = prompt('Titolo del nuovo capitolo?');
    if (!title || !editor) return;
  
    editor.chain()
      .focus('end')
      .insertContent({ type: 'heading', attrs: { level: 1 }, content:[{ type: 'text', text: title }] })
      .run();
  };
  
  const handleCommitChapter = (chapterId: string, label: string, branch: string) => {
    if (isReadOnly) return;
    if (!editor) return;
    const doc = editor.getJSON();
    const chapter = chapters.find(c => c.id === chapterId);
    if (!chapter) return;
  
    const snapshot = createChapterSnapshot(chapter, doc, fragmentLinks, label, branch);
  
    setChapters(prev => prev.map(c =>
      c.id === chapterId
        ? { ...c, snapshots: [...c.snapshots, snapshot], activeSnapshotId: snapshot.id }
        : c
    ));
  };
  
  const handleChapterStatusChange = (chapterId: string, status: ChapterStatus) => {
    if (isReadOnly) return;
    setChapters(prev => prev.map(c =>
      c.id === chapterId ? { ...c, status } : c
    ));
  };
  
  const handleRestoreChapterSnapshot = (chapterId: string, snapshot: ChapterSnapshot) => {
    if (isReadOnly) return;
    if (!editor) return;
    const currentDoc = editor.getJSON();
    const newDoc = restoreChapterSnapshot(currentDoc, chapterId, snapshot);
    editor.commands.setContent(newDoc);
  
    if (snapshot.fragmentLinks) {
      setFragmentLinks(prev => ({ ...prev, ...snapshot.fragmentLinks }));
    }
  
    setChapters(prev => prev.map(c =>
      c.id === chapterId ? { ...c, activeSnapshotId: snapshot.id } : c
    ));
  
    setHistoryDrawerChapterId(null);
  };

  const handleOverwriteChapterSnapshot = (chapterId: string, snapshotId: string) => {
    if (isReadOnly) return;
    if (!editor) return;

    setChapters(prev => prev.map(chapter => {
      if (chapter.id !== chapterId) {
        return chapter;
      }

      const targetSnapshot = chapter.snapshots.find(snapshot => snapshot.id === snapshotId);
      if (!targetSnapshot) {
        return chapter;
      }

      return {
        ...chapter,
        snapshots: chapter.snapshots.map(snapshot =>
          snapshot.id === snapshotId
            ? overwriteChapterSnapshot(snapshot, chapter, editor.getJSON(), fragmentLinks)
            : snapshot
        ),
      };
    }));

    setPendingUpdatedAt(Date.now());
  };

  const handleDeleteChapterSnapshot = (chapterId: string, snapshotId: string) => {
    if (isReadOnly) return;
    setChapters(prev => prev.map(chapter => {
      if (chapter.id !== chapterId) {
        return chapter;
      }

      const removedSnapshot = chapter.snapshots.find(snapshot => snapshot.id === snapshotId);
      const remainingSnapshots = chapter.snapshots.filter(snapshot => snapshot.id !== snapshotId);
      const fallbackSnapshotId =
        removedSnapshot?.parentId && remainingSnapshots.some(snapshot => snapshot.id === removedSnapshot.parentId)
          ? removedSnapshot.parentId
          : remainingSnapshots[remainingSnapshots.length - 1]?.id ?? null;

      setVersions(currentVersions => currentVersions.map(version => {
        const nextChapterVersions = { ...(version.data.chapterVersions ?? {}) };
        if (nextChapterVersions[chapterId] === snapshotId) {
          if (fallbackSnapshotId) {
            nextChapterVersions[chapterId] = fallbackSnapshotId;
          } else {
            delete nextChapterVersions[chapterId];
          }
        }

        return {
          ...version,
          data: {
            ...version.data,
            chapterVersions: nextChapterVersions,
          },
        };
      }));

      return {
        ...chapter,
        snapshots: remainingSnapshots,
        activeSnapshotId:
          chapter.activeSnapshotId === snapshotId
            ? fallbackSnapshotId
            : chapter.activeSnapshotId,
      };
    }));
  };

  const confirmDiscardPending = (targetLabel: string) => {
    if (!isPendingDirty) {
      return true;
    }

    return window.confirm(
      `Hai uno stato globale pending non ancora committato. Tornando a "${targetLabel}" perderai il pending corrente. Vuoi continuare?`
    );
  };

  const loadGlobalVersion = (versionId: string) => {
    const snapshot = versions.find(version => version.id === versionId);
    if (!snapshot || !editor) return;
    if (versionId !== activeVersionId && !confirmDiscardPending(snapshot.label)) return;

    const nextFragmentLinks = resolveFragmentLinks(snapshot.data, chapters);

    setTitle(snapshot.data.title);
    setCategories(snapshot.data.categories || []);
    setEntities(snapshot.data.entities || []);
    setRelations(snapshot.data.relations || []);
    setTodos(snapshot.data.todos || []);
    setFragmentLinks(nextFragmentLinks);
    setChapters(prev => prev.map(chapter => {
      const snapshotId = snapshot.data.chapterVersions?.[chapter.id];
      const hasSnapshot = snapshotId
        ? chapter.snapshots.some(chapterSnapshot => chapterSnapshot.id === snapshotId)
        : false;

      return {
        ...chapter,
        activeSnapshotId: hasSnapshot ? snapshotId! : null,
      };
    }));

    editor.commands.setContent(snapshot.data.content);
    setActiveVersionId(snapshot.id);
    setPendingBaseVersionId(snapshot.id);
    setPendingUpdatedAt(Date.now());
    setView('editor');
  };

  const handleOverwriteGlobalVersion = (versionId: string) => {
    if (isReadOnly) return;
    if (!editor) return;

    const baseVersion = versions.find(version => version.id === versionId);
    if (!baseVersion) {
      window.alert('Nessun commit globale attivo da sovrascrivere.');
      return;
    }

    const updatedChapters = commitActiveChapterSnapshots(chapters);
    setChapters(updatedChapters);

    const snapshotData = {
      ...buildWorkspaceData(),
      chapterVersions: buildChapterVersionMap(updatedChapters),
    };

    setVersions(prev => prev.map(version =>
      version.id === versionId
        ? {
            ...version,
            timestamp: Date.now(),
            data: snapshotData,
          }
        : version
    ));
    setActiveVersionId(versionId);
    setPendingBaseVersionId(versionId);
    setPendingUpdatedAt(Date.now());
  };

  const handleDeleteGlobalVersion = (versionId: string) => {
    if (isReadOnly) return;
    const target = versions.find(version => version.id === versionId);
    if (!target) return;

    const remainingVersions = versions.filter(version => version.id !== versionId);
    const fallbackVersionId =
      target.parentId && remainingVersions.some(version => version.id === target.parentId)
        ? target.parentId
        : remainingVersions[remainingVersions.length - 1]?.id ?? '';

    setVersions(remainingVersions);
    if (activeVersionId === versionId) {
      setActiveVersionId(fallbackVersionId);
      setPendingBaseVersionId(fallbackVersionId || null);
    }
  };

  const handleRenameGlobalBranch = (branchName: string) => {
    if (isReadOnly) return;
    const nextBranchName = window.prompt('Nuovo nome del branch globale?', branchName)?.trim();
    if (!nextBranchName || nextBranchName === branchName) return;

    setVersions(prev => prev.map(version =>
      version.branch === branchName
        ? { ...version, branch: nextBranchName }
        : version
    ));
    setPendingUpdatedAt(Date.now());
  };

  const handleRenameChapterBranch = (chapterId: string, branchName: string) => {
    if (isReadOnly) return;
    const nextBranchName = window.prompt('Nuovo nome del branch del capitolo?', branchName)?.trim();
    if (!nextBranchName || nextBranchName === branchName) return;

    setChapters(prev => prev.map(chapter =>
      chapter.id === chapterId
        ? {
            ...chapter,
            snapshots: chapter.snapshots.map(snapshot =>
              snapshot.branch === branchName
                ? { ...snapshot, branch: nextBranchName }
                : snapshot
            ),
          }
        : chapter
    ));
    setPendingUpdatedAt(Date.now());
  };

  const handleExportPdf = () => {
    window.print();
  };

  const reopenLinkInfoMenu = (linkId: string) => {
    if (!editor) return;
    const target = editor.view.dom.querySelector(`[data-link-id="${linkId}"]`) as HTMLElement | null;
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const rect = target.getBoundingClientRect();
    setActiveLinkId(linkId);
    setMenuPos({ x: rect.left + rect.width / 2, y: rect.bottom + 8 });
    setAddMoreMenu(null);
  };

  const returnFromGraphSnapshot = () => {
    if (!graphNavigationContext) return;
    setView('editor');
    setMainSidebarOpen(true);
    const linkId = graphNavigationContext.linkId;
    setGraphNavigationContext(null);
    requestAnimationFrame(() => requestAnimationFrame(() => reopenLinkInfoMenu(linkId)));
  };

  const openGraphSnapshot = (snapshotId: string, linkId: string) => {
    const snapshot = graphSnapshots.find(item => item.id === snapshotId);
    if (snapshot?.mapId) {
      setActiveGraphMapId(snapshot.mapId);
    }
    setActiveGraphId(snapshotId);
    setView('graph');
    setMainSidebarOpen(false);
    setGraphNavigationContext({
      linkId,
      snapshotLabel: snapshot?.label ?? 'Snapshot del grafo',
    });
    closeInfoMenu();
  };

  const handleExportProject = () => {
    const payload = {
      format: 'writex-project',
      schemaVersion: 1,
      exportedAt: Date.now(),
      document: buildPersistedDocumentData(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const safeTitle = title.trim().replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'progetto';
    anchor.href = url;
    anchor.download = `${safeTitle}${PROJECT_FILE_EXTENSION}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleShareProject = async () => {
    if (!window.writexAgent) {
      window.alert('Link condivisibile non disponibile: API agente non inizializzata.');
      return;
    }

    await db.saveDocument(DOC_ID, buildPersistedDocumentData());
    const result = await window.writexAgent.callTool('createShareLink', {});
    const shareData = result.data as { url: string; warning?: string };
    const shareUrl = shareData.url;

    try {
      await navigator.clipboard.writeText(shareUrl);
      window.alert(shareData.warning ?? 'Link della storia copiato negli appunti.');
    } catch {
      window.prompt('Copia questo link per condividere la storia:', shareUrl);
    }
  };

  const handleRequestProjectImport = () => {
    if (isReadOnly) return;
    importProjectInputRef.current?.click();
  };

  const handleImportProject = async (event: ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    const shouldImport = window.confirm('Importando un file locale andrai a sostituire il progetto aperto. Vuoi continuare?');
    if (!shouldImport) {
      event.target.value = '';
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const imported = parsed.document ?? parsed;

      setTitle(imported.title ?? 'Il mio capolavoro');
      setCategories(imported.categories ?? DEFAULT_CATEGORIES);
      setEntities(imported.entities ?? []);
      setRelations(imported.relations ?? []);
      setTodos(imported.todos ?? []);
      setVersions(imported.versions ?? []);
      setActiveVersionId(imported.activeVersionId ?? '');
      setPendingUpdatedAt(imported.pendingUpdatedAt ?? Date.now());
      setPendingBaseVersionId(imported.pendingBaseVersionId ?? null);
      setFragmentLinks(imported.fragmentLinks ?? {});
      setChapters(imported.chapters ?? []);
      setGraphMaps(imported.graphMaps ?? [DEFAULT_GRAPH_MAP]);
      setActiveGraphMapId(imported.activeGraphMapId ?? DEFAULT_GRAPH_MAP_ID);
      setGraphSnapshots((imported.graphSnapshots ?? []).map((snapshot: GraphSnapshot) => ({
        ...snapshot,
        mapId: snapshot.mapId ?? imported.activeGraphMapId ?? DEFAULT_GRAPH_MAP_ID,
      })));
      setActiveGraphId(imported.activeGraphId ?? null);
      editor.commands.setContent(imported.content ?? '');
      setView('editor');
      setHistoryDrawerChapterId(null);
      setEditingEntity(null);
      setActiveLinkId(null);
      setMenuPos(null);
      setAddMoreMenu(null);
      db.saveDocument(DOC_ID, {
        title: imported.title ?? 'Il mio capolavoro',
        categories: imported.categories ?? DEFAULT_CATEGORIES,
        entities: imported.entities ?? [],
        relations: imported.relations ?? [],
        todos: imported.todos ?? [],
        versions: imported.versions ?? [],
        activeVersionId: imported.activeVersionId ?? '',
        pendingUpdatedAt: imported.pendingUpdatedAt ?? Date.now(),
        pendingBaseVersionId: imported.pendingBaseVersionId ?? null,
        fragmentLinks: imported.fragmentLinks ?? {},
        content: imported.content ?? '',
        chapters: imported.chapters ?? [],
        graphMaps: imported.graphMaps ?? [DEFAULT_GRAPH_MAP],
        activeGraphMapId: imported.activeGraphMapId ?? DEFAULT_GRAPH_MAP_ID,
        graphSnapshots: (imported.graphSnapshots ?? []).map((snapshot: GraphSnapshot) => ({
          ...snapshot,
          mapId: snapshot.mapId ?? imported.activeGraphMapId ?? DEFAULT_GRAPH_MAP_ID,
        })),
        activeGraphId: imported.activeGraphId ?? null,
      });
    } catch {
      window.alert('Il file selezionato non e valido o non usa il formato progetto previsto.');
    } finally {
      event.target.value = '';
    }
  };

  useEffect(() => {
    const handleWindowKeydown = (event: KeyboardEvent) => {
      const modifierPressed = event.metaKey || event.ctrlKey;
      if (!modifierPressed || event.key.toLowerCase() !== 's') {
        return;
      }

      if (event.shiftKey && !event.altKey) {
        event.preventDefault();
        handleOverwriteGlobalVersion(activeVersionId);
      }

      if (event.shiftKey && event.altKey) {
        event.preventDefault();
        if (!activeChapterId) {
          window.alert('Seleziona un capitolo con uno snapshot attivo prima di sovrascriverlo.');
          return;
        }

        const chapter = chapters.find(item => item.id === activeChapterId);
        if (!chapter?.activeSnapshotId) {
          window.alert('Il capitolo selezionato non ha uno snapshot attivo da sovrascrivere.');
          return;
        }

        handleOverwriteChapterSnapshot(chapter.id, chapter.activeSnapshotId);
      }
    };

    window.addEventListener('keydown', handleWindowKeydown);
    return () => window.removeEventListener('keydown', handleWindowKeydown);
  }, [activeChapterId, activeVersionId, chapters, fragmentLinks, versions]);

  useEffect(() => {
    if (view !== 'graph' && graphNavigationContext) {
      setGraphNavigationContext(null);
    }
  }, [view, graphNavigationContext]);

  const navigateToPos = (pos: number, block: ScrollLogicalPosition = 'center') => {
    if (!editor) return;
    editor.commands.setTextSelection(pos);
    editor.view.dom.focus();
    const dom = (editor.view.nodeDOM(pos) as HTMLElement | null) ?? (editor.view.domAtPos(pos).node as HTMLElement | null);
    if (dom?.scrollIntoView) dom.scrollIntoView({ behavior: 'smooth', block });
  };

  const navigateToChapterStart = (chapterId: string) => {
    if (!editor) return;
    let headingPos = -1;
    editor.state.doc.descendants((node, pos) => {
      if (headingPos !== -1) return false;
      if (node.type.name === 'heading' && node.attrs.id === chapterId) {
        headingPos = pos;
        return false;
      }
    });

    if (headingPos !== -1) {
      navigateToPos(headingPos, 'start');
    }
  };

  const handleSaveEntity = (ent: Entity) => {
    if (isReadOnly) return;
    setEntities(prev => {
      const exists = prev.find(e => e.id === ent.id);
      return exists ? prev.map(e => e.id === ent.id ? ent : e) : [...prev, ent];
    });
    setEditingEntity(null);
  };

  const handleDeleteEntity = (id: string) => {
    if (isReadOnly) return;
    setEntities(prev => prev.filter(e => e.id !== id));
    setEditingEntity(null);
  };

  const closeInfoMenu = () => {
    setActiveLinkId(null);
    setMenuPos(null);
    setAddMoreMenu(null);
  };

  const openEntityEditor = (entity: Entity) => {
    setEditingEntity(entity);
    if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      setMainSidebarOpen(false);
    }
  };

  const closeMobileSidebarFromContent = () => {
    if (mainSidebarOpen && window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      setMainSidebarOpen(false);
    }
  };

  const removeTodoMarkFromEditor = (todoId: string) => {
    if (!editor || isReadOnly) return;

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
  if (cloudLoadError) {
    return (
      <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <h1>Progetto cloud non disponibile</h1>
        <p>{cloudLoadError}</p>
        <a href={`${import.meta.env.BASE_URL}cloud`}>Torna alla schermata cloud</a>
      </div>
    );
  }

  return (
    <div
      className={`app-layout ${mainSidebarOpen ? '' : 'focus-mode'}`}
      style={{
        ...selectedTheme.vars,
        ...({ '--keyboard-offset': `${keyboardOffset}px` } as CSSProperties & Record<'--keyboard-offset', string>),
        position: 'fixed', // Questo bypassa il contenitore max-width del #root di Vite!
        inset: 0, // Significa top:0, left:0, right:0, bottom:0
        display: 'flex',
        overflow: 'hidden',
        background: 'var(--bg)'
      }}
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
      <div className="brightness-control" onClick={event => event.stopPropagation()}>
        <div className="top-floating-controls">
          <button
            className="brightness-toggle"
            onClick={() => setBrightnessPanelOpen(open => !open)}
            title="Cambia tema interfaccia"
            type="button"
          >
            {themeMode === 'dark' ? <Moon size={15} /> : <Sun size={15} />}
          </button>
          {view === 'editor' && editor && !isReadOnly && (
            <button
              className={`formatting-toggle ${formattingPanelOpen ? 'active' : ''}`}
              onClick={() => setFormattingPanelOpen(open => !open)}
              title="Strumenti di formattazione"
              type="button"
            >
              <SlidersHorizontal size={15} />
            </button>
          )}
        </div>
        {brightnessPanelOpen && (
          <div className="brightness-popover">
            <div className="brightness-popover-header">
              <span>Tema</span>
              <strong>{selectedTheme.label}</strong>
            </div>
            <div className="brightness-popover-actions">
              {(['light', 'shadow', 'dark'] as UiThemeMode[]).map(mode => (
                <button
                  key={mode}
                  className={themeMode === mode ? 'active' : ''}
                  onClick={() => setThemeMode(mode)}
                >
                  {THEME_PRESETS[mode].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── SIDEBAR PRINCIPALE ─── */}
      {canToggleReadMode && (
        <button
          className={`mode-floating-btn ${isReadOnly ? 'read' : 'edit'}`}
          onClick={() => setOwnerMode(mode => (mode === 'read' ? 'edit' : 'read'))}
          title={isReadOnly ? 'Passa alla modalita editor' : 'Passa alla modalita lettura'}
          type="button"
        >
          {isReadOnly ? <Pencil size={18} /> : <Eye size={18} />}
          <span>{isReadOnly ? 'Editor' : 'Lettura'}</span>
        </button>
      )}

      <div
        className="sidebar-shell"
        style={{
          width: mainSidebarOpen ? 'var(--sb-width)' : '0px',
          minWidth: mainSidebarOpen ? 'var(--sb-width)' : '0px',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          borderRight: mainSidebarOpen ? '1px solid var(--sb-border)' : 'none',
          flexShrink: 0
        }}
      >
        <div style={{ width: 'var(--sb-width)', height: '100%' }}>
          <Sidebar
            currentView={view} 
            onCloseSidebar={() => setMainSidebarOpen(false)} // Passiamo la funzione per chiudere
            headings={headings} navigateToPos={navigateToPos}
            activeVersion={activeVersion}
            isPendingDirty={isPendingDirty}
            onExportPdf={handleExportPdf}
            onExportProject={handleExportProject}
            onShareProject={handleShareProject}
            onImportProject={handleRequestProjectImport}
            readOnly={isReadOnly}
            setView={setView}
            categories={categories} setCategories={setCategories}
            entities={entities} setEditingEntity={openEntityEditor}
            todos={todos}

            chapters={chapters}
            activeChapterId={activeChapterId}
            onSelectChapter={(id: string) => {
              setActiveChapterId(id);
              if (!editor) return;
              if (view !== 'editor') {
                setView('editor');
                requestAnimationFrame(() => requestAnimationFrame(() => navigateToChapterStart(id)));
                return;
              }
              navigateToChapterStart(id);
            }}
            onCreateChapter={() => !isReadOnly && handleCreateChapter()}
            onCommitChapter={(chapterId: string, label: string, branch: string) => !isReadOnly && handleCommitChapter(chapterId, label, branch)}
            onChapterStatusChange={(chapterId: string, status: ChapterStatus) => !isReadOnly && handleChapterStatusChange(chapterId, status)}
            onRenameChapterBranch={(chapterId: string, branch: string) => !isReadOnly && handleRenameChapterBranch(chapterId, branch)}
            onOpenChapterHistory={(id: string) => setHistoryDrawerChapterId(id)}
            
            onAddTodo={(text: string, anchorId?: string) =>
              !isReadOnly && setTodos(prev =>[...prev, { id: anchorId || uid(), text, done: false, anchorId }])}
            onToggleTodo={(id: string) => {
              if (isReadOnly) return;
              setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
              removeTodoMarkFromEditor(id);
            }}
              
            onRemoveTodo={(id: string) => {
              if (isReadOnly) return;
              setTodos(prev => prev.filter(t => t.id !== id));
              removeTodoMarkFromEditor(id);
            }}
            onNavigateTodo={(todoId: string) => {
              if (!editor || view !== 'editor') return;
              let foundPos = -1;
              editor.state.doc.descendants((node, pos) => {
                if (node.marks.find((m: any) => m.type.name === 'todoMark' && m.attrs.todoId === todoId))
                  foundPos = pos;
              });
              if (foundPos !== -1) navigateToPos(foundPos);
            }}
          />
        </div>
      </div>

      {/* ─── AREA CONTENUTO PRINCIPALE ─── */}
      <div
        style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        onPointerDown={closeMobileSidebarFromContent}
      >
        
        {/* Pulsante Floating (solo per Grafo o Timeline, quando chiusa) */}
        {!mainSidebarOpen && (
          <button
            className="icon-btn sidebar-open-btn"
            onClick={() => setMainSidebarOpen(true)}
            title="Mostra barra laterale"
          >
            <PanelLeft size={18} />
          </button>
        )}

        {view === 'editor' ? (
          <div className={`editor-main ${mainSidebarOpen ? '' : 'editor-main-focus'}`}>
            <div className={`editor-area ${mainSidebarOpen ? '' : 'editor-area-focus'}`}>
              
              {/* Contenitore Titolo e Bottone Focus */}
              <div className="editor-header">
                <input
                  className="doc-title-input" value={title}
                  onChange={e => !isReadOnly && setTitle(e.target.value)}
                  placeholder="Titolo del Documento..."
                  readOnly={isReadOnly}
                  style={{ marginBottom: 0 }} // Override al margin originale
                />
                {cloudContext && (
                  <div className="editor-header-actions">
                    <div className={`cloud-mode-badge ${isReadOnly ? 'read' : 'edit'}`}>
                      Cloud: {cloudContext.role === 'owner' && !isReadOnly ? 'modifica' : 'solo lettura'}
                    </div>
                  </div>
                )}
              </div>

              <div className="editor-wrap">
                {editor && !isReadOnly && <EditorToolbar editor={editor} mobileOpen={formattingPanelOpen} />}
                {editor && !isReadOnly && (
                  <BubbleMenu
                    editor={editor}
                    className="bubble-menu"
                    shouldShow={({ from, to }) => {
                      if (from === to) return false;
                      return !editor.isActive('entityLink');
                    }}
                  >
                    <EditorBubbleMenu
                      editor={editor}
                      categories={categories}
                      entities={entities}
                      graphSnapshots={graphSnapshots}
                      fragmentLinks={fragmentLinks}
                      setFragmentLinks={setFragmentLinks}
                      onAddTodo={(txt: string, id?: string) =>
                        !isReadOnly && setTodos(prev =>[...prev, { id: id || uid(), text: txt, done: false, anchorId: id }])}
                      onAddRelation={(rel: Relation) =>
                        !isReadOnly && setRelations(prev => [...prev, rel])}
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
                style={{ position: 'fixed', left: menuPos.x, top: menuPos.y, transform: 'translateX(-50%)', zIndex: 1000 }}
                onClick={e => e.stopPropagation()}
              >
                <EntityInfoMenu
                  linkId={activeLinkId}
                  editor={isReadOnly ? null : editorRef.current}
                  entities={entities}
                  graphSnapshots={graphSnapshots}
                  fragmentLinks={fragmentLinks}
                  setFragmentLinks={isReadOnly ? (() => undefined) : setFragmentLinks}
                  onOpenEntity={(e) => { closeInfoMenu(); openEntityEditor(e); }}
                  onOpenGraphSnapshot={openGraphSnapshot}
                  onClose={closeInfoMenu}
                  onAddMore={(excludeIds) => {
                    if (isReadOnly) return;
                    setAddMoreMenu({
                      linkId: activeLinkId!,
                      excludeIds,
                      pos: { x: menuPos!.x, y: menuPos!.y + 10 }
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
                style={{ position: 'fixed', left: addMoreMenu.pos.x, top: addMoreMenu.pos.y, transform: 'translateX(-50%)', zIndex: 1001 }}
                onClick={e => e.stopPropagation()}
              >
                <AddEntityMenu
                  linkId={addMoreMenu.linkId}
                  excludeIds={addMoreMenu.excludeIds}
                  categories={categories}
                  entities={entities}
                  setFragmentLinks={setFragmentLinks}
                  onAddRelation={(rel: Relation) => !isReadOnly && setRelations(prev => [...prev, rel])}
                  onClose={() => setAddMoreMenu(null)}
                />
              </div>
            )}
          </div>
        ) : view === 'versions' ? (
          <VersionsPage
            versions={versions}
            activeId={activeVersionId}
            pendingVersion={{
              id: PENDING_VERSION_ID,
              parentId: pendingBaseVersionId,
              label: 'Pending',
              branch: activeVersion?.branch ?? 'main',
              timestamp: pendingUpdatedAt,
              data: currentWorkspaceData,
            }}
            isPendingDirty={isPendingDirty}
            onBack={() => setView('editor')}
            onCommit={handleCommitGlobal}
            onLoad={loadGlobalVersion}
            onOverwrite={handleOverwriteGlobalVersion}
            onDelete={handleDeleteGlobalVersion}
            onRenameBranch={handleRenameGlobalBranch}
            readOnly={isReadOnly}
          />
        ) : view === 'graph' ? (
          <div style={{ flex: 1, display: 'flex', overflow: 'hidden', background: 'var(--bg)' }}>
            <GraphView
              entities={entities}
              categories={categories}
              graphMaps={graphMaps}
              setGraphMaps={setGraphMaps}
              activeGraphMapId={activeGraphMapId}
              setActiveGraphMapId={setActiveGraphMapId}
              graphSnapshots={graphSnapshots}
              setGraphSnapshots={setGraphSnapshots}
              activeGraphId={activeGraphId}
              setActiveGraphId={setActiveGraphId}
              navigationContext={graphNavigationContext}
              onReturnToContext={returnFromGraphSnapshot}
              readOnly={isReadOnly}
              mainSidebarOpen={mainSidebarOpen}
            />
          </div>
        ) : null}

      </div>

      {editingEntity && (
        <EntityModal
          entity={editingEntity}
          onSave={handleSaveEntity}
          onDelete={handleDeleteEntity}
          onClose={() => setEditingEntity(null)}
          readOnly={isReadOnly}
        />
      )}

      {historyDrawerChapterId && (() => {
        const ch = chapters.find(c => c.id === historyDrawerChapterId);
        return ch ? (
          <ChapterHistoryDrawer
            chapter={ch}
            onClose={() => setHistoryDrawerChapterId(null)}
            onRestore={(chapterId: string, snapshot: ChapterSnapshot) => !isReadOnly && handleRestoreChapterSnapshot(chapterId, snapshot)}
            onOverwrite={(chapterId: string, snapshotId: string) => !isReadOnly && handleOverwriteChapterSnapshot(chapterId, snapshotId)}
            onDelete={(chapterId: string, snapshotId: string) => !isReadOnly && handleDeleteChapterSnapshot(chapterId, snapshotId)}
          />
        ) : null;
      })()}
      <input
        ref={importProjectInputRef}
        type="file"
        accept={`${PROJECT_FILE_EXTENSION},application/json`}
        style={{ display: 'none' }}
        onChange={handleImportProject}
      />
    </div>
  );
}

function EditorBubbleMenu({ editor, categories, entities, graphSnapshots, setFragmentLinks, onAddTodo, onAddRelation }: any) {
  const[mode, setMode] = useState<'default' | 'todo' | 'link'>('default');
  const[todoText, setTodoText] = useState("");

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
                    [newLinkId]: { entityIds: [e.id], todoIds:[] }
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

        {graphSnapshots.length > 0 && (
          <div>
            <div className="bm-group-title">Snapshot grafo</div>
            {graphSnapshots.map((snapshot: GraphSnapshot) => (
              <button key={snapshot.id} className="bm-list-item" onClick={() => {
                const { from, to } = editor.state.selection;
                if (from === to) return;

                const newLinkId = uid();
                editor.chain().focus()
                  .unsetMark('entityLink')
                  .setMark('entityLink', { linkId: newLinkId })
                  .run();

                setFragmentLinks((prev: FragmentLinks) => ({
                  ...prev,
                  [newLinkId]: { entityIds: [], todoIds:[], graphSnapshotIds: [snapshot.id] }
                }));

                setMode('default');
              }}>
                {snapshot.label}
              </button>
            ))}
          </div>
        )}

        {entities.length === 0 && graphSnapshots.length === 0 && (
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

function EntityInfoMenu({
  linkId, editor, entities, graphSnapshots, fragmentLinks, setFragmentLinks,
  onOpenEntity, onOpenGraphSnapshot, onClose, onAddMore
}: {
  linkId: string;
  editor: any;
  entities: Entity[];
  graphSnapshots: GraphSnapshot[];
  fragmentLinks: FragmentLinks;
  setFragmentLinks: (fn: (prev: FragmentLinks) => FragmentLinks) => void;
  onOpenEntity: (e: Entity) => void;
  onOpenGraphSnapshot: (snapshotId: string, linkId: string) => void;
  onClose: () => void;
  onAddMore: (excludeIds: string[]) => void;
}) {
  const fragment = fragmentLinks[linkId] ?? { entityIds: [], todoIds:[], graphSnapshotIds: [] };
  const linkedEntities = fragment.entityIds
    .map((id: string) => entities.find(e => e.id === id))
    .filter(Boolean) as Entity[];
  const linkedGraphSnapshots = (fragment.graphSnapshotIds ?? [])
    .map((id: string) => graphSnapshots.find(snapshot => snapshot.id === id))
    .filter(Boolean) as GraphSnapshot[];

  const removeEntity = (entityIdToRemove: string) => {
    const newIds = fragment.entityIds.filter((id: string) => id !== entityIdToRemove);
    if (newIds.length === 0 && !(fragment.graphSnapshotIds?.length)) {
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

  const removeGraphSnapshot = (graphSnapshotId: string) => {
    const newIds = (fragment.graphSnapshotIds ?? []).filter((id: string) => id !== graphSnapshotId);
    if (newIds.length === 0 && fragment.entityIds.length === 0) {
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
        [linkId]: { ...fragment, graphSnapshotIds: newIds }
      }));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {linkedEntities.length === 0 && linkedGraphSnapshots.length === 0 && (
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
      {linkedGraphSnapshots.map(snapshot => (
        <div key={snapshot.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <div
            className="bm-info-card"
            style={{ flex: 1, margin: 0 }}
            onClick={() => onOpenGraphSnapshot(snapshot.id, linkId)}
          >
            <div className="bm-info-avatar">G</div>
            <div className="bm-info-name">
              {snapshot.label}
              <div style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Snapshot del grafo</div>
            </div>
            <ChevronRight size={14} color="var(--text-subtle)" />
          </div>
          <button
            className="icon-btn small"
            style={{
              background: 'var(--editor-bg)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow)', width: '36px', height: '42px', borderRadius: '8px'
            }}
            onClick={ev => { ev.stopPropagation(); removeGraphSnapshot(snapshot.id); }}
            title="Scollega snapshot"
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

function AddEntityMenu({
  linkId, excludeIds, categories, entities, setFragmentLinks, onAddRelation, onClose
}: {
  linkId: string;
  excludeIds: string[];
  categories: Category[];
  entities: Entity[];
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
                    entityIds: [...(prev[linkId]?.entityIds ||[]), e.id]
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
