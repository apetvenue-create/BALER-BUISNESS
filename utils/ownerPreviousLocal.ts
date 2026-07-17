import type { OwnerPreviousEntry } from '../types';

const KEY = 'transaction_manager_owner_previous_v1';
const keyForUser = (userId: string) => `${KEY}:${userId}`;

export type OwnerPreviousLocalMap = Record<string, OwnerPreviousEntry[]>;

export function loadOwnerPreviousLocal(userId: string): OwnerPreviousLocalMap {
  try {
    const raw = localStorage.getItem(keyForUser(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as OwnerPreviousLocalMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function persistOwnerPreviousForAccount(
  userId: string,
  accountName: string,
  entries: OwnerPreviousEntry[]
): void {
  const all = loadOwnerPreviousLocal(userId);
  all[accountName] = entries;
  try {
    localStorage.setItem(keyForUser(userId), JSON.stringify(all));
  } catch (e) {
    console.warn('owner previous localStorage save failed', e);
  }
}

export function removeOwnerPreviousLocalForAccount(userId: string, accountName: string): void {
  const all = loadOwnerPreviousLocal(userId);
  if (!(accountName in all)) return;
  const next = { ...all };
  delete next[accountName];
  try {
    localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  } catch (e) {
    console.warn('owner previous localStorage remove failed', e);
  }
}

export function renameOwnerPreviousLocalKey(userId: string, oldName: string, newName: string): void {
  const all = loadOwnerPreviousLocal(userId);
  if (!(oldName in all)) return;
  const next = { ...all };
  next[newName] = next[oldName];
  delete next[oldName];
  try {
    localStorage.setItem(keyForUser(userId), JSON.stringify(next));
  } catch (e) {
    console.warn('owner previous localStorage rename failed', e);
  }
}

/** Server rows first; then local rows whose id is not on the server (e.g. offline / no table). */
export function mergeOwnerPreviousEntries(
  server: OwnerPreviousEntry[],
  local: OwnerPreviousEntry[]
): OwnerPreviousEntry[] {
  const byId = new Map<number, OwnerPreviousEntry>();
  for (const e of server) byId.set(e.id, e);
  for (const e of local) {
    if (!byId.has(e.id)) byId.set(e.id, e);
  }
  return Array.from(byId.values());
}
