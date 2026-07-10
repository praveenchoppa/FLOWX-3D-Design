/**
 * projectWorkspaceStorage.js — Step 10 local persistence (no backend).
 */

import {
  DEFAULT_PROJECT_META,
  STORAGE_KEY_META,
  STORAGE_KEY_NOTES_PREFIX,
  FALLBACK_PROJECT_ID,
} from "./projectWorkspaceConfig";

function generateProjectId() {
  return `LDX-${Date.now().toString(36).toUpperCase().slice(-8)}`;
}

export function loadProjectMeta() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_META);
    if (!raw) {
      const fresh = {
        ...DEFAULT_PROJECT_META,
        projectId:   generateProjectId(),
        createdDate: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(STORAGE_KEY_META, JSON.stringify(fresh));
      return fresh;
    }
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PROJECT_META,
      ...parsed,
      projectId: parsed.projectId ?? generateProjectId(),
    };
  } catch {
    return {
      ...DEFAULT_PROJECT_META,
      projectId:   generateProjectId(),
      createdDate: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
    };
  }
}

export function saveProjectMeta(meta) {
  const next = {
    ...meta,
    lastUpdated: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY_META, JSON.stringify(next));
  return next;
}

export function notesStorageKey(projectId) {
  return `${STORAGE_KEY_NOTES_PREFIX}${projectId ?? FALLBACK_PROJECT_ID}`;
}

export function loadConsultantNotes(projectId) {
  try {
    return localStorage.getItem(notesStorageKey(projectId)) ?? "";
  } catch {
    return "";
  }
}

export function saveConsultantNotes(projectId, text) {
  try {
    localStorage.setItem(notesStorageKey(projectId), text);
  } catch {
    /* ignore quota errors */
  }
}

export function countNotes(notes) {
  if (!notes?.trim()) return 0;
  return notes.trim().split(/\n+/).filter(Boolean).length;
}

export function formatDisplayDate(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}
