import type { JSONContent } from '@tiptap/react';
import { createChapterSnapshot, syncChaptersFromDoc } from './chapterUtils';
import { db } from './db';
import { uid } from './editorUtils';
import { writexAgentToolDefinitions } from './agentToolDefinitions';
import type {
  Category,
  Chapter,
  ChapterStatus,
  Entity,
  FragmentLinks,
  GraphEdgeData,
  GraphMap,
  GraphNodeData,
  GraphSnapshot,
  Relation,
  Snapshot,
  Todo,
} from './types';

const DOC_ID = 'main-workspace';
const DEFAULT_GRAPH_MAP_ID = 'graph-map-main';

const defaultCategories: Category[] = [
  { id: 'cat-chars', name: 'Personaggi', icon: 'User' },
  { id: 'cat-locs', name: 'Luoghi', icon: 'Map' },
  { id: 'cat-objs', name: 'Oggetti', icon: 'Box' },
  { id: 'cat-groups', name: 'Gruppi', icon: 'Users' },
];

const defaultGraphMap = (): GraphMap => ({
  id: DEFAULT_GRAPH_MAP_ID,
  label: 'Mappa principale',
  order: 0,
  createdAt: Date.now(),
});

export type WritexProjectDocument = {
  title: string;
  content: JSONContent | string;
  categories: Category[];
  entities: Entity[];
  relations: Relation[];
  todos: Todo[];
  versions: Snapshot[];
  activeVersionId: string;
  pendingUpdatedAt: number;
  pendingBaseVersionId: string | null;
  fragmentLinks: FragmentLinks;
  chapters: Chapter[];
  graphMaps: GraphMap[];
  activeGraphMapId: string;
  graphSnapshots: GraphSnapshot[];
  activeGraphId: string | null;
};

export type WritexProjectFile = {
  format: 'writex-project';
  schemaVersion: 1;
  exportedAt: number;
  document: WritexProjectDocument;
};

type AgentResult<T> = {
  ok: true;
  data: T;
  warnings?: string[];
};

type AgentMutationResult<T> = AgentResult<T> & {
  saved: true;
};

type LinkTarget = {
  entityIds?: string[];
  todoIds?: string[];
  graphSnapshotIds?: string[];
};

type CreateEntityInput = {
  categoryId: string;
  name: string;
  avatar?: string;
  image?: string;
  desc?: string;
  fields?: Array<{ title: string; value: string; id?: string }>;
};

type CreateGraphSnapshotInput = {
  mapId?: string;
  label?: string;
  copyFromSnapshotId?: string;
};

type LinkTextInput = LinkTarget & {
  text: string;
  chapterId?: string;
  occurrence?: number;
};

type AgentToolName = typeof writexAgentToolDefinitions[number]['name'];
type AgentBridgeCall = {
  type?: 'writex-agent-call';
  id?: string;
  name: AgentToolName;
  args?: Record<string, unknown>;
};
type AgentBridgeResult = {
  type: 'writex-agent-result';
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

function createEmptyDocument(): WritexProjectDocument {
  return {
    title: 'Il mio capolavoro',
    content: '',
    categories: defaultCategories,
    entities: [],
    relations: [],
    todos: [],
    versions: [],
    activeVersionId: '',
    pendingUpdatedAt: Date.now(),
    pendingBaseVersionId: null,
    fragmentLinks: {},
    chapters: [],
    graphMaps: [defaultGraphMap()],
    activeGraphMapId: DEFAULT_GRAPH_MAP_ID,
    graphSnapshots: [],
    activeGraphId: null,
  };
}

function normalizeDocument(data: Partial<WritexProjectDocument> | null): WritexProjectDocument {
  const fallback = createEmptyDocument();
  return {
    ...fallback,
    ...data,
    title: data?.title ?? fallback.title,
    content: data?.content ?? fallback.content,
    categories: data?.categories ?? fallback.categories,
    entities: data?.entities ?? fallback.entities,
    relations: data?.relations ?? fallback.relations,
    todos: data?.todos ?? fallback.todos,
    versions: data?.versions ?? fallback.versions,
    fragmentLinks: data?.fragmentLinks ?? fallback.fragmentLinks,
    chapters: data?.chapters ?? fallback.chapters,
    graphMaps: data?.graphMaps?.length ? data.graphMaps : fallback.graphMaps,
    activeGraphMapId: data?.activeGraphMapId ?? fallback.activeGraphMapId,
    graphSnapshots: (data?.graphSnapshots ?? fallback.graphSnapshots).map(snapshot => ({
      ...snapshot,
      mapId: snapshot.mapId ?? data?.activeGraphMapId ?? fallback.activeGraphMapId,
    })),
  };
}

function asDoc(content: JSONContent | string): JSONContent {
  if (typeof content !== 'string') return content;
  if (!content.trim()) return { type: 'doc', content: [] };
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
  };
}

function touch(document: WritexProjectDocument): WritexProjectDocument {
  return { ...document, pendingUpdatedAt: Date.now() };
}

function syncChapters(document: WritexProjectDocument): WritexProjectDocument {
  const content = asDoc(document.content);
  return {
    ...document,
    content,
    chapters: syncChaptersFromDoc(content, document.chapters, document.fragmentLinks),
  };
}

async function saveDocument(document: WritexProjectDocument) {
  const synced = syncChapters(touch(document));
  await db.saveDocument(DOC_ID, synced);
  window.dispatchEvent(new CustomEvent('writex-agent-document-saved', { detail: synced }));
  return synced;
}

async function mutate<T>(
  updater: (document: WritexProjectDocument) => { document: WritexProjectDocument; data: T; warnings?: string[] }
): Promise<AgentMutationResult<T>> {
  const current = await writexAgent.getProject();
  const result = updater(current.data);
  const saved = await saveDocument(result.document);
  return { ok: true, saved: true, data: result.data, warnings: result.warnings ?? (saved ? undefined : []) };
}

function requireEntity(document: WritexProjectDocument, entityId: string) {
  const entity = document.entities.find(item => item.id === entityId);
  if (!entity) throw new Error(`Entity not found: ${entityId}`);
  return entity;
}

function requireGraphSnapshot(document: WritexProjectDocument, snapshotId: string) {
  const snapshot = document.graphSnapshots.find(item => item.id === snapshotId);
  if (!snapshot) throw new Error(`Graph snapshot not found: ${snapshotId}`);
  return snapshot;
}

function buildChapterVersionMap(chapters: Chapter[]) {
  return Object.fromEntries(chapters.flatMap(chapter => (
    chapter.activeSnapshotId ? [[chapter.id, chapter.activeSnapshotId]] : []
  )));
}

function normalizeTarget(target: LinkTarget) {
  return {
    entityIds: [...new Set(target.entityIds ?? [])],
    todoIds: [...new Set(target.todoIds ?? [])],
    graphSnapshotIds: [...new Set(target.graphSnapshotIds ?? [])],
  };
}

function markTextNode(node: JSONContent, input: LinkTextInput, state: { matches: number; changed: boolean; linkId: string }): JSONContent {
  if (state.changed) return node;
  if (node.text === undefined || !input.text) return node;

  const index = node.text.indexOf(input.text);
  if (index < 0) return node;

  state.matches += 1;
  const occurrence = input.occurrence ?? 1;
  if (state.matches !== occurrence) return node;

  const before = node.text.slice(0, index);
  const selected = node.text.slice(index, index + input.text.length);
  const after = node.text.slice(index + input.text.length);
  const marks = node.marks ?? [];
  const linkedMarks = [...marks.filter(mark => mark.type !== 'entityLink'), { type: 'entityLink', attrs: { linkId: state.linkId } }];
  const pieces: JSONContent[] = [];
  if (before) pieces.push({ ...node, text: before });
  pieces.push({ ...node, text: selected, marks: linkedMarks });
  if (after) pieces.push({ ...node, text: after });
  state.changed = true;
  return { type: '__split__', content: pieces };
}

function walkAndMarkText(node: JSONContent, input: LinkTextInput, state: { matches: number; changed: boolean; linkId: string }): JSONContent {
  const marked = markTextNode(node, input, state);
  if (marked.type === '__split__') return marked;
  if (!node.content?.length || state.changed) return node;

  const content: JSONContent[] = [];
  for (const child of node.content) {
    const next = walkAndMarkText(child, input, state);
    if (next.type === '__split__') {
      content.push(...(next.content ?? []));
    } else {
      content.push(next);
    }
  }
  return { ...node, content };
}

function linkTextInDoc(document: WritexProjectDocument, input: LinkTextInput) {
  const doc = asDoc(document.content);
  const linkId = uid();
  const state = { matches: 0, changed: false, linkId };
  const content = doc.content ?? [];
  let inChapter = !input.chapterId;

  const nextContent = content.map(node => {
    const isH1 = node.type === 'heading' && node.attrs?.level === 1;
    const nodeId = node.attrs?.id ?? node.attrs?.['data-id'];
    if (isH1) inChapter = !input.chapterId || nodeId === input.chapterId;
    if (!inChapter || state.changed) return node;
    return walkAndMarkText(node, input, state);
  });

  if (!state.changed) {
    throw new Error(`Text not found for link: ${input.text}`);
  }

  const target = normalizeTarget(input);
  return {
    document: {
      ...document,
      content: { ...doc, content: nextContent },
      fragmentLinks: {
        ...document.fragmentLinks,
        [linkId]: target,
      },
      relations: [
        ...document.relations,
        ...target.entityIds.map(entityId => ({ id: uid(), sourceId: linkId, targetId: entityId, type: 'mention' })),
      ],
    },
    linkId,
  };
}

function createBridgeResult(id: string | undefined, ok: boolean, result?: unknown, error?: string): AgentBridgeResult {
  return {
    type: 'writex-agent-result',
    id: id ?? uid(),
    ok,
    result,
    error,
  };
}

async function runBridgeCall(call: AgentBridgeCall): Promise<AgentBridgeResult> {
  try {
    const result = await writexAgent.callTool(call.name, call.args ?? {});
    return createBridgeResult(call.id, true, result);
  } catch (error) {
    return createBridgeResult(call.id, false, undefined, error instanceof Error ? error.message : String(error));
  }
}

function publishBridgeResult(result: AgentBridgeResult) {
  window.writexAgentLastResult = result;
  window.dispatchEvent(new CustomEvent('writex-agent-result', { detail: result }));
  window.postMessage(result, window.location.origin);
}

function isBridgeCall(value: unknown): value is AgentBridgeCall {
  if (!value || typeof value !== 'object') return false;
  const maybeCall = value as Partial<AgentBridgeCall>;
  return maybeCall.name !== undefined && typeof maybeCall.name === 'string';
}

function installMessageBridge() {
  window.addEventListener('message', event => {
    if (event.source !== window || !isBridgeCall(event.data) || event.data.type !== 'writex-agent-call') return;
    runBridgeCall(event.data).then(publishBridgeResult);
  });
}

function installCustomEventBridge() {
  window.addEventListener('writex-agent-call', event => {
    const detail = (event as CustomEvent<AgentBridgeCall>).detail;
    if (!isBridgeCall(detail)) return;
    runBridgeCall(detail).then(publishBridgeResult);
  });
}

function installHashBridge() {
  const prefix = '#writex-agent=';
  const runHashCommand = () => {
    if (!window.location.hash.startsWith(prefix)) return;
    try {
      const encoded = window.location.hash.slice(prefix.length);
      const call = JSON.parse(decodeURIComponent(encoded)) as AgentBridgeCall;
      if (isBridgeCall(call)) {
        runBridgeCall(call).then(publishBridgeResult);
      }
    } catch (error) {
      publishBridgeResult(createBridgeResult(undefined, false, undefined, error instanceof Error ? error.message : String(error)));
    }
  };

  window.addEventListener('hashchange', runHashCommand);
  window.setTimeout(runHashCommand, 0);
}

export const writexAgent = {
  listTools(): AgentResult<typeof writexAgentToolDefinitions> {
    return { ok: true, data: writexAgentToolDefinitions };
  },

  async callTool(name: AgentToolName, args: Record<string, unknown> = {}) {
    switch (name) {
      case 'getProject':
        return this.getProject();
      case 'exportProject':
        return this.exportProject();
      case 'setTitle':
        return this.setTitle(String(args.title ?? ''));
      case 'createChapter':
        return this.createChapter(String(args.title ?? ''), typeof args.body === 'string' ? args.body : '');
      case 'updateChapterStatus':
        return this.updateChapterStatus(String(args.chapterId ?? ''), args.status as ChapterStatus);
      case 'commitChapter':
        return this.commitChapter(
          String(args.chapterId ?? ''),
          String(args.label ?? ''),
          typeof args.branch === 'string' ? args.branch : 'main'
        );
      case 'commitGlobal':
        return this.commitGlobal(String(args.label ?? ''), typeof args.branch === 'string' ? args.branch : 'main');
      case 'createCategory':
        return this.createCategory(String(args.name ?? ''), typeof args.icon === 'string' ? args.icon : 'Tag');
      case 'createEntity':
        return this.createEntity(args as CreateEntityInput);
      case 'createTodo':
        return this.createTodo(String(args.text ?? ''), typeof args.anchorId === 'string' ? args.anchorId : undefined);
      case 'linkText':
        return this.linkText(args as LinkTextInput);
      case 'createGraphMap':
        return this.createGraphMap(String(args.label ?? ''));
      case 'createGraphSnapshot':
        return this.createGraphSnapshot(args as CreateGraphSnapshotInput);
      case 'addGraphNode':
        return this.addGraphNode(String(args.snapshotId ?? ''), args.node as GraphNodeData);
      case 'addGraphEdge':
        return this.addGraphEdge(String(args.snapshotId ?? ''), args.edge as Omit<GraphEdgeData, 'id'> & { id?: string });
      default:
        throw new Error(`Unknown WriteX agent tool: ${name}`);
    }
  },

  async getProject(): Promise<AgentResult<WritexProjectDocument>> {
    const data = await db.loadDocument(DOC_ID);
    return { ok: true, data: syncChapters(normalizeDocument(data)) };
  },

  async exportProject(): Promise<AgentResult<WritexProjectFile>> {
    const current = await this.getProject();
    return {
      ok: true,
      data: {
        format: 'writex-project',
        schemaVersion: 1,
        exportedAt: Date.now(),
        document: current.data,
      },
    };
  },

  async importProject(project: WritexProjectFile | { document: WritexProjectDocument }): Promise<AgentMutationResult<WritexProjectDocument>> {
    const document = normalizeDocument(project.document);
    const saved = await saveDocument(document);
    return { ok: true, saved: true, data: saved };
  },

  async setTitle(title: string) {
    return mutate(document => ({ document: { ...document, title }, data: { title } }));
  },

  async createChapter(title: string, body = '') {
    return mutate(document => {
      const content = asDoc(document.content);
      const chapterId = uid();
      const additions: JSONContent[] = [
        { type: 'heading', attrs: { level: 1, id: chapterId }, content: [{ type: 'text', text: title }] },
      ];
      if (body.trim()) {
        additions.push({ type: 'paragraph', content: [{ type: 'text', text: body }] });
      }
      const nextDocument = syncChapters({ ...document, content: { ...content, content: [...(content.content ?? []), ...additions] } });
      return { document: nextDocument, data: nextDocument.chapters.find(chapter => chapter.id === chapterId)! };
    });
  },

  async updateChapterStatus(chapterId: string, status: ChapterStatus) {
    return mutate(document => ({
      document: { ...document, chapters: document.chapters.map(chapter => (chapter.id === chapterId ? { ...chapter, status } : chapter)) },
      data: { chapterId, status },
    }));
  },

  async commitChapter(chapterId: string, label: string, branch = 'main') {
    return mutate(document => {
      const chapter = document.chapters.find(item => item.id === chapterId);
      if (!chapter) throw new Error(`Chapter not found: ${chapterId}`);
      const snapshot = createChapterSnapshot(chapter, asDoc(document.content), document.fragmentLinks, label, branch);
      return {
        document: {
          ...document,
          chapters: document.chapters.map(item =>
            item.id === chapterId
              ? { ...item, snapshots: [...item.snapshots, snapshot], activeSnapshotId: snapshot.id }
              : item
          ),
        },
        data: snapshot,
      };
    });
  },

  async commitGlobal(label: string, branch = 'main') {
    return mutate(document => {
      const snapshot: Snapshot = {
        id: uid(),
        parentId: document.activeVersionId || null,
        label,
        branch,
        timestamp: Date.now(),
        data: {
          title: document.title,
          content: document.content,
          categories: document.categories,
          entities: document.entities,
          relations: document.relations,
          todos: document.todos,
          fragmentLinks: document.fragmentLinks,
          chapterVersions: buildChapterVersionMap(document.chapters),
        },
      };
      return {
        document: {
          ...document,
          versions: [...document.versions, snapshot],
          activeVersionId: snapshot.id,
          pendingBaseVersionId: snapshot.id,
        },
        data: snapshot,
      };
    });
  },

  async createCategory(name: string, icon = 'Tag') {
    return mutate(document => {
      const category: Category = { id: uid(), name, icon };
      return { document: { ...document, categories: [...document.categories, category] }, data: category };
    });
  },

  async createEntity(input: CreateEntityInput) {
    return mutate(document => {
      if (!document.categories.some(category => category.id === input.categoryId)) {
        throw new Error(`Category not found: ${input.categoryId}`);
      }
      const entity: Entity = {
        id: uid(),
        categoryId: input.categoryId,
        name: input.name,
        avatar: input.avatar ?? input.name.slice(0, 2),
        image: input.image,
        desc: input.desc ?? '',
        fields: (input.fields ?? []).map(field => ({ id: field.id ?? uid(), title: field.title, value: field.value })),
      };
      return { document: { ...document, entities: [...document.entities, entity] }, data: entity };
    });
  },

  async updateEntity(entity: Entity) {
    return mutate(document => {
      requireEntity(document, entity.id);
      return {
        document: { ...document, entities: document.entities.map(item => (item.id === entity.id ? entity : item)) },
        data: entity,
      };
    });
  },

  async createTodo(text: string, anchorId?: string) {
    return mutate(document => {
      const todo: Todo = { id: anchorId ?? uid(), text, done: false, anchorId };
      return { document: { ...document, todos: [...document.todos, todo] }, data: todo };
    });
  },

  async linkText(input: LinkTextInput) {
    return mutate(document => {
      [...(input.entityIds ?? [])].forEach(entityId => requireEntity(document, entityId));
      [...(input.graphSnapshotIds ?? [])].forEach(snapshotId => requireGraphSnapshot(document, snapshotId));
      const linked = linkTextInDoc(document, input);
      return { document: linked.document, data: { linkId: linked.linkId, ...normalizeTarget(input) } };
    });
  },

  async createGraphMap(label: string) {
    return mutate(document => {
      const map: GraphMap = { id: `map-${uid()}`, label, order: document.graphMaps.length, createdAt: Date.now() };
      return { document: { ...document, graphMaps: [...document.graphMaps, map], activeGraphMapId: map.id, activeGraphId: null }, data: map };
    });
  },

  async createGraphSnapshot(input: CreateGraphSnapshotInput = {}) {
    return mutate(document => {
      const mapId = input.mapId ?? document.activeGraphMapId;
      if (!document.graphMaps.some(map => map.id === mapId)) throw new Error(`Graph map not found: ${mapId}`);
      const scoped = document.graphSnapshots.filter(snapshot => (snapshot.mapId ?? mapId) === mapId);
      const copyFrom = input.copyFromSnapshotId
        ? document.graphSnapshots.find(snapshot => snapshot.id === input.copyFromSnapshotId)
        : null;
      const snapshot: GraphSnapshot = {
        id: uid(),
        mapId,
        label: input.label ?? (copyFrom ? `${copyFrom.label} (copia)` : `Snapshot ${scoped.length + 1}`),
        timestamp: Date.now(),
        order: scoped.length,
        nodes: copyFrom?.nodes.map(node => ({ ...node, position: { ...node.position } })) ?? [],
        edges: copyFrom?.edges.map(edge => ({ ...edge })) ?? [],
      };
      return {
        document: { ...document, graphSnapshots: [...document.graphSnapshots, snapshot], activeGraphMapId: mapId, activeGraphId: snapshot.id },
        data: snapshot,
      };
    });
  },

  async addGraphNode(snapshotId: string, node: GraphNodeData) {
    return mutate(document => {
      requireEntity(document, node.entityId);
      requireGraphSnapshot(document, snapshotId);
      return {
        document: {
          ...document,
          graphSnapshots: document.graphSnapshots.map(snapshot =>
            snapshot.id === snapshotId
              ? { ...snapshot, nodes: [...snapshot.nodes.filter(item => item.entityId !== node.entityId), node] }
              : snapshot
          ),
        },
        data: node,
      };
    });
  },

  async addGraphEdge(snapshotId: string, edge: Omit<GraphEdgeData, 'id'> & { id?: string }) {
    return mutate(document => {
      const snapshot = requireGraphSnapshot(document, snapshotId);
      requireEntity(document, edge.sourceId);
      requireEntity(document, edge.targetId);
      const graphEdge: GraphEdgeData = { id: edge.id ?? `edge-${uid()}`, sourceId: edge.sourceId, targetId: edge.targetId, type: edge.type };
      return {
        document: {
          ...document,
          graphSnapshots: document.graphSnapshots.map(item =>
            item.id === snapshot.id ? { ...item, edges: [...item.edges.filter(existing => existing.id !== graphEdge.id), graphEdge] } : item
          ),
        },
        data: graphEdge,
      };
    });
  },
};

declare global {
  interface Window {
    writexAgent: typeof writexAgent;
    writexAgentLastResult?: AgentBridgeResult;
    __writexAgentBridgeInstalled?: boolean;
  }
}

export function installWritexAgentApi() {
  if (typeof window !== 'undefined') {
    window.writexAgent = writexAgent;
    if (!window.__writexAgentBridgeInstalled) {
      installMessageBridge();
      installCustomEventBridge();
      installHashBridge();
      window.__writexAgentBridgeInstalled = true;
    }
  }
}
