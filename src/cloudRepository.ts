import type { User } from '@supabase/supabase-js';
import { db } from './db';
import { supabase } from './supabaseClient';
import type { WritexProjectDocument } from './types';

export const LOCAL_DOC_ID = 'main-workspace';

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
  return data as Omit<CloudProjectRow, 'document'>;
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
  return data as Omit<CloudProjectRow, 'document'>;
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
