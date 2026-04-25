// chapterUtils.ts
// Utility pure per il versioning per capitolo — nessuna dipendenza da React

import type { JSONContent } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import type { Chapter, ChapterSnapshot, FragmentLinks } from './types';
import { uid } from './editorUtils';

// ─── Estrae i nodi di un capitolo dal documento ────────────────────────────────
// Restituisce tutti i nodi TipTap compresi tra l'H1 con id=chapterId
// e il successivo H1 (o la fine del documento)
export function extractChapterContent(
  doc: JSONContent,
  chapterId: string
): JSONContent {
  const nodes = doc.content ?? [];
  let capturing = false;
  const chapterNodes: JSONContent[] = [];

  for (const node of nodes) {
    const isH1 = node.type === 'heading' && node.attrs?.level === 1;
    const nodeId = node.attrs?.id ?? node.attrs?.['data-id'];

    if (isH1 && nodeId === chapterId) {
      capturing = true;
      chapterNodes.push(node);
      continue;
    }

    if (capturing) {
      if (isH1) break; // prossimo capitolo → stop
      chapterNodes.push(node);
    }
  }

  return { type: 'doc', content: chapterNodes };
}

// ─── Conta le parole in un JSONContent ────────────────────────────────────────
export function countWords(content: JSONContent): number {
  let text = '';

  function walk(node: JSONContent) {
    if (node.text) text += node.text + ' ';
    (node.content ?? []).forEach(walk);
  }

  walk(content);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Ricava le entityRefs da fragmentLinks per i nodi di un capitolo ──────────
// Analizza il contenuto del capitolo cercando mark "entityLink"
// e restituisce gli entityIds unici trovati
export function extractEntityRefs(
  chapterContent: JSONContent,
  fragmentLinks: FragmentLinks
): string[] {
  const linkIds = new Set<string>();

  function walk(node: JSONContent) {
    (node.marks ?? []).forEach((mark: any) => {
      if (mark.type === 'entityLink' && mark.attrs?.linkId) {
        linkIds.add(mark.attrs.linkId);
      }
    });
    (node.content ?? []).forEach(walk);
  }

  walk(chapterContent);

  const entityIds = new Set<string>();
  linkIds.forEach(linkId => {
    const fragment = fragmentLinks[linkId];
    if (fragment) {
      fragment.entityIds.forEach((id: string) => entityIds.add(id));
    }
  });

  return Array.from(entityIds);
}

// ─── Sincronizza la lista dei Chapter dallo stato del documento ───────────────
// Chiamata ogni volta che il documento TipTap cambia.
// NON tocca snapshots esistenti — aggiorna solo title, order, entityRefs.
export function syncChaptersFromDoc(
  doc: JSONContent,
  existingChapters: Chapter[],
  fragmentLinks: FragmentLinks
): Chapter[] {
  const nodes = doc.content ?? [];
  const h1Nodes = nodes.filter(
    n => n.type === 'heading' && n.attrs?.level === 1
  );

  const existingMap = new Map(existingChapters.map(c => [c.id, c]));

  return h1Nodes.map((node, index) => {
    const id = node.attrs?.id ?? node.attrs?.['data-id'] ?? uid();
    const title = node.content?.map((n: any) => n.text ?? '').join('') || 'Capitolo senza titolo';
    const content = extractChapterContent(doc, id);
    const entityRefs = extractEntityRefs(content, fragmentLinks);

    const existing = existingMap.get(id);
    if (existing) {
      return { ...existing, title, order: index, entityRefs };
    }

    // Nuovo capitolo — crea entry vuota
    return {
      id,
      title,
      order: index,
      status: 'draft' as const,
      snapshots: [],
      activeSnapshotId: null,
    };
  });
}

// ─── Crea un nuovo snapshot per un capitolo ───────────────────────────────────
export function createChapterSnapshot(
  chapter: Chapter,
  doc: JSONContent,
  fragmentLinks: FragmentLinks,
  label: string,
  branch: string
): ChapterSnapshot {
  const content = extractChapterContent(doc, chapter.id);
  const wordCount = countWords(content);
  const entityRefs = extractEntityRefs(content, fragmentLinks);

  return {
    id: uid(),
    parentId: chapter.activeSnapshotId,
    branch,
    label,
    timestamp: Date.now(),
    content,
    entityRefs,
    wordCount,
  };
}

// ─── Ripristina il contenuto di un capitolo da uno snapshot ──────────────────
// Sostituisce i nodi del capitolo nel documento con quelli dello snapshot
export function restoreChapterSnapshot(
  doc: JSONContent,
  chapterId: string,
  snapshot: ChapterSnapshot
): JSONContent {
  const nodes = doc.content ?? [];
  const result: JSONContent[] = [];
  let skipUntilNextH1 = false;
  let inserted = false;

  for (const node of nodes) {
    const isH1 = node.type === 'heading' && node.attrs?.level === 1;
    const nodeId = node.attrs?.id ?? node.attrs?.['data-id'];

    if (isH1 && nodeId === chapterId) {
      // Inserisci i nodi dello snapshot al posto dei nodi attuali
      result.push(...(snapshot.content.content ?? []));
      inserted = true;
      skipUntilNextH1 = true;
      continue;
    }

    if (skipUntilNextH1 && isH1) {
      skipUntilNextH1 = false;
    }

    if (!skipUntilNextH1) {
      result.push(node);
    }
  }

  if (!inserted) {
    // Capitolo non trovato — restituisci doc invariato
    return doc;
  }

  return { ...doc, content: result };
}