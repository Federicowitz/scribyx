import type { User } from '@supabase/supabase-js';
import { db } from './db';
import { supabase } from './supabaseClient';
import type { WritexProjectDocument } from './types';

export const LOCAL_DOC_ID = 'main-workspace';
const CLOUD_PROJECT_CACHE_PREFIX = 'cloud-project:';

export type CloudRole = 'owner' | 'viewer';

export type CloudProjectSummary = {
  id: string;
  title: string;
  owner_id: string;
  updated_at: string;
  created_at: string;
  role: CloudRole;
};

export type CloudShare = {
  id: string;
  project_id: string;
  identifier: string;
  created_at: string;
};

type CloudProjectRow = {
  id: string;
  title: string;
  owner_id: string;
  document: WritexProjectDocument;
  created_at: string;
  updated_at: string;
};

export type CachedCloudProject = {
  cacheType: 'cloud-project';
  cloudProjectId: string;
  title: string;
  role: CloudRole;
  remoteUpdatedAt: string;
  cachedAt: number;
  document: WritexProjectDocument;
};

function requireClient() {
  if (!supabase) {
    throw new Error('Supabase non configurato. Imposta VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }
  return supabase;
}

function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export async function loadLocalProjectDocument() {
  return db.loadDocument(LOCAL_DOC_ID) as Promise<WritexProjectDocument | null>;
}

export async function loadCachedCloudProject(projectId: string) {
  return db.loadDocument(`${CLOUD_PROJECT_CACHE_PREFIX}${projectId}`) as Promise<CachedCloudProject | null>;
}

export async function saveCachedCloudProject(input: {
  projectId: string;
  title: string;
  role: CloudRole;
  remoteUpdatedAt: string;
  document: WritexProjectDocument;
}) {
  const cached: CachedCloudProject = {
    cacheType: 'cloud-project',
    cloudProjectId: input.projectId,
    title: input.title,
    role: input.role,
    remoteUpdatedAt: input.remoteUpdatedAt,
    cachedAt: Date.now(),
    document: input.document,
  };
  await db.saveDocument(`${CLOUD_PROJECT_CACHE_PREFIX}${input.projectId}`, cached);
  return cached;
}

export async function clearIndexedDbCache() {
  await db.clearAll();
}

export async function getCurrentUser() {
  const client = requireClient();
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getProfile(user: User) {
  const client = requireClient();
  const { data, error } = await client
    .from('profiles')
    .select('id,email,nickname')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data as { id: string; email: string | null; nickname: string | null } | null;
}

export async function upsertProfile(user: User, nickname: string) {
  const client = requireClient();
  const { error } = await client.from('profiles').upsert({
    id: user.id,
    email: user.email ?? null,
    nickname: normalizeIdentifier(nickname),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function listCloudProjects(userId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('id,title,owner_id,created_at,updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw error;

  return ((data ?? []) as Omit<CloudProjectRow, 'document'>[]).map(project => ({
    ...project,
    role: project.owner_id === userId ? 'owner' : 'viewer',
  })) satisfies CloudProjectSummary[];
}

export async function getCloudProject(projectId: string, userId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('id,title,owner_id,document,created_at,updated_at')
    .eq('id', projectId)
    .single();
  if (error) throw error;

  const project = data as CloudProjectRow;
  return {
    ...project,
    role: project.owner_id === userId ? 'owner' : 'viewer',
  };
}

export async function getCloudProjectMetadata(projectId: string, userId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .select('id,title,owner_id,created_at,updated_at')
    .eq('id', projectId)
    .single();
  if (error) throw error;

  const project = data as Omit<CloudProjectRow, 'document'>;
  return {
    ...project,
    role: project.owner_id === userId ? 'owner' : 'viewer',
  };
}

export async function createCloudProject(title: string, document: WritexProjectDocument) {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .insert({
      title: title.trim() || document.title || 'Progetto senza titolo',
      document,
    })
    .select('id,title,owner_id,created_at,updated_at')
    .single();
  if (error) throw error;
  const project = data as Omit<CloudProjectRow, 'document'>;
  await saveCachedCloudProject({
    projectId: project.id,
    title: project.title,
    role: 'owner',
    remoteUpdatedAt: project.updated_at,
    document,
  });
  return project;
}

export async function updateCloudProject(projectId: string, document: WritexProjectDocument) {
  const client = requireClient();
  const { data, error } = await client
    .from('projects')
    .update({
      title: document.title || 'Progetto senza titolo',
      document,
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
    .select('id,title,owner_id,created_at,updated_at')
    .single();
  if (error) throw error;
  const project = data as Omit<CloudProjectRow, 'document'>;
  await saveCachedCloudProject({
    projectId: project.id,
    title: project.title,
    role: 'owner',
    remoteUpdatedAt: project.updated_at,
    document,
  });
  return project;
}

export async function listProjectShares(projectId: string) {
  const client = requireClient();
  const { data, error } = await client
    .from('project_members')
    .select('id,project_id,identifier,created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CloudShare[];
}

export async function addProjectShare(projectId: string, identifier: string) {
  const client = requireClient();
  const normalized = normalizeIdentifier(identifier);
  if (!normalized) throw new Error('Inserisci una mail o un nickname.');
  const { error } = await client.from('project_members').insert({
    project_id: projectId,
    identifier: normalized,
  });
  if (error) throw error;
}

export async function removeProjectShare(shareId: string) {
  const client = requireClient();
  const { error } = await client.from('project_members').delete().eq('id', shareId);
  if (error) throw error;
}
