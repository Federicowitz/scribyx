export type Todo = { id: string; text: string; done: boolean; anchorId?: string };
export type CustomField = { id: string; title: string; value: string };

export type Category = { id: string; name: string; icon: string };
export type Entity = { id: string; categoryId: string; name: string; avatar: string; image?: string; desc: string; fields: CustomField[] };
export type Relation = { id: string; sourceId: string; targetId: string; type?: string };
import type { JSONContent } from '@tiptap/react';

// ─── Graph Snapshot Types ─────────────────────────────────────────
export type GraphNodeData = {
  entityId: string;
  position: { x: number; y: number };
};

export type GraphEdgeData = {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
};

export type GraphSnapshot = {
  id: string;
  label: string;
  timestamp: number;
  order: number;
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
};
 
export type ChapterStatus = 'draft' | 'revised' | 'final';

export type Snapshot = {
  id: string; parentId: string | null; label: string; branch: string; timestamp: number;
  data: { 
    title: string; content: any; 
    categories: Category[]; entities: Entity[]; 
    relations: Relation[]; todos: Todo[];
    fragmentLinks?: FragmentLinks;
    chapterVersions?: Record<string, string>;
  };
};

export type FragmentLinks = {
  [linkId: string]: {
    entityIds: string[];
    todoIds: string[];
    graphSnapshotIds?: string[];
  }
}

export interface ChapterSnapshot {
  id: string;
  parentId: string | null;
  branch: string;
  label: string;
  timestamp: number;
  content: JSONContent;       // nodi TipTap di questo solo capitolo
  entityRefs: string[];       // id delle entità menzionate (da fragmentLinks)
  fragmentLinks: FragmentLinks; // collegamenti entità ↔ testo di questo capitolo
  wordCount: number;
}
 
export interface Chapter {
  id: string;                 // = data-id del nodo H1 in TipTap (via BlockIdExtension)
  title: string;
  order: number;
  status: ChapterStatus;
  snapshots: ChapterSnapshot[];
  activeSnapshotId: string | null;
}
 

