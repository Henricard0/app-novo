import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { uid } from './id';
import { kvStorage } from './storage';
import type {
  AiJob,
  Attachment,
  Flashcard,
  Note,
  Notebook,
  Settings,
  SyncKind,
  Task,
} from './types';

export const DEFAULT_SETTINGS: Settings = {
  themeMode: 'system',
  accent: '#6366F1',
  fontScale: 1,
  editorFont: 'sans',
  openNotesInPreview: false,
  speechLang: 'pt-BR',
  aiLanguage: 'português do Brasil',
  notificationsEnabled: true,
  dailyReminderTime: '19:00',
  taskReminderOffsetMin: 30,
  autoSync: true,
  widgets: { stats: true, review: true, tasks: true, recent: true, quickActions: true },
  userName: '',
};

type Coll<T> = Record<string, T>;

export interface SyncMeta {
  /** Maior `server_updated_at` já recebido da nuvem (ISO). */
  lastPulledAt: string | null;
  lastSyncAt: number | null;
  lastError: string | null;
}

interface State {
  notebooks: Coll<Notebook>;
  notes: Coll<Note>;
  flashcards: Coll<Flashcard>;
  tasks: Coll<Task>;
  settings: Settings;
  /** Registros alterados localmente que ainda não foram enviados à nuvem. Chave: "kind:id". */
  dirty: Record<string, true>;
  aiQueue: AiJob[];
  sync: SyncMeta;
}

interface Actions {
  // Cadernos
  upsertNotebook(input: Partial<Notebook> & { name: string }): Notebook;
  deleteNotebook(id: string): void;
  // Notas
  createNote(input?: Partial<Note>): Note;
  updateNote(id: string, patch: Partial<Note>): void;
  deleteNote(id: string): void;
  addAttachment(noteId: string, att: Attachment): void;
  updateAttachment(noteId: string, attId: string, patch: Partial<Attachment>): void;
  removeAttachment(noteId: string, attId: string): void;
  // Flashcards
  addFlashcards(cards: { front: string; back: string }[], noteId: string | null): Flashcard[];
  updateFlashcard(id: string, patch: Partial<Flashcard>): void;
  deleteFlashcard(id: string): void;
  // Tarefas
  upsertTask(input: Partial<Task> & { title: string }): Task;
  toggleTask(id: string): void;
  deleteTask(id: string): void;
  // Ajustes
  setSettings(patch: Partial<Settings>): void;
  // Fila de IA offline
  enqueueAi(job: Omit<AiJob, 'id' | 'createdAt'>): void;
  removeAiJob(id: string): void;
  // Sincronização
  applyRemote(kind: SyncKind, id: string, data: unknown, deleted: boolean, updatedAt: number): void;
  clearDirty(keys: string[]): void;
  setSyncMeta(patch: Partial<SyncMeta>): void;
  /** Substitui tudo por um backup importado (marca tudo como pendente de envio). */
  importBackup(data: BackupFile): void;
  resetAll(): void;
}

export interface BackupFile {
  app: 'lumen';
  version: 1;
  exportedAt: string;
  notebooks: Notebook[];
  notes: Note[];
  flashcards: Flashcard[];
  tasks: Task[];
  settings?: Settings;
}

export const COLLECTION: Record<SyncKind, 'notebooks' | 'notes' | 'flashcards' | 'tasks'> = {
  notebook: 'notebooks',
  note: 'notes',
  flashcard: 'flashcards',
  task: 'tasks',
};

const key = (kind: SyncKind, id: string) => `${kind}:${id}`;

const initialState: State = {
  notebooks: {},
  notes: {},
  flashcards: {},
  tasks: {},
  settings: DEFAULT_SETTINGS,
  dirty: {},
  aiQueue: [],
  sync: { lastPulledAt: null, lastSyncAt: null, lastError: null },
};

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => {
      /** Aplica uma alteração local e marca o registro para sincronizar. */
      const put = (kind: SyncKind, record: Notebook | Note | Flashcard | Task) => {
        const coll = COLLECTION[kind];
        set((s) => ({
          [coll]: { ...s[coll], [record.id]: record },
          dirty: { ...s.dirty, [key(kind, record.id)]: true },
        }) as Partial<State>);
      };

      return {
        ...initialState,

        upsertNotebook(input) {
          const now = Date.now();
          const prev = input.id ? get().notebooks[input.id] : undefined;
          const nb: Notebook = {
            emoji: '📘',
            color: get().settings.accent,
            createdAt: now,
            ...prev,
            ...input,
            id: input.id ?? uid(),
            updatedAt: now,
          };
          put('notebook', nb);
          return nb;
        },
        deleteNotebook(id) {
          const nb = get().notebooks[id];
          if (!nb) return;
          const now = Date.now();
          put('notebook', { ...nb, deleted: true, updatedAt: now });
          // As notas do caderno continuam existindo, só ficam "sem caderno".
          for (const n of Object.values(get().notes)) {
            if (n.notebookId === id && !n.deleted) put('note', { ...n, notebookId: null, updatedAt: now });
          }
        },

        createNote(input = {}) {
          const now = Date.now();
          const note: Note = {
            notebookId: null,
            title: '',
            content: '',
            attachments: [],
            tags: [],
            createdAt: now,
            ...input,
            id: uid(),
            updatedAt: now,
          };
          put('note', note);
          return note;
        },
        updateNote(id, patch) {
          const n = get().notes[id];
          if (!n) return;
          put('note', { ...n, ...patch, id, updatedAt: Date.now() });
        },
        deleteNote(id) {
          const n = get().notes[id];
          if (!n) return;
          const now = Date.now();
          put('note', { ...n, deleted: true, updatedAt: now });
          for (const c of Object.values(get().flashcards)) {
            if (c.noteId === id && !c.deleted) put('flashcard', { ...c, deleted: true, updatedAt: now });
          }
        },
        addAttachment(noteId, att) {
          const n = get().notes[noteId];
          if (!n) return;
          get().updateNote(noteId, { attachments: [...n.attachments, att] });
        },
        updateAttachment(noteId, attId, patch) {
          const n = get().notes[noteId];
          if (!n) return;
          get().updateNote(noteId, {
            attachments: n.attachments.map((a) => (a.id === attId ? { ...a, ...patch } : a)),
          });
        },
        removeAttachment(noteId, attId) {
          const n = get().notes[noteId];
          if (!n) return;
          get().updateNote(noteId, { attachments: n.attachments.filter((a) => a.id !== attId) });
        },

        addFlashcards(cards, noteId) {
          const now = Date.now();
          const created = cards
            .filter((c) => c.front.trim() && c.back.trim())
            .map<Flashcard>((c) => ({
              id: uid(),
              noteId,
              front: c.front.trim(),
              back: c.back.trim(),
              ease: 2.5,
              interval: 0,
              repetitions: 0,
              dueAt: now,
              createdAt: now,
              updatedAt: now,
            }));
          for (const c of created) put('flashcard', c);
          return created;
        },
        updateFlashcard(id, patch) {
          const c = get().flashcards[id];
          if (!c) return;
          put('flashcard', { ...c, ...patch, id, updatedAt: Date.now() });
        },
        deleteFlashcard(id) {
          const c = get().flashcards[id];
          if (!c) return;
          put('flashcard', { ...c, deleted: true, updatedAt: Date.now() });
        },

        upsertTask(input) {
          const now = Date.now();
          const prev = input.id ? get().tasks[input.id] : undefined;
          const task: Task = {
            dueAt: null,
            done: false,
            priority: 'normal',
            createdAt: now,
            ...prev,
            ...input,
            id: input.id ?? uid(),
            updatedAt: now,
          };
          put('task', task);
          return task;
        },
        toggleTask(id) {
          const t = get().tasks[id];
          if (!t) return;
          put('task', { ...t, done: !t.done, updatedAt: Date.now() });
        },
        deleteTask(id) {
          const t = get().tasks[id];
          if (!t) return;
          put('task', { ...t, deleted: true, updatedAt: Date.now() });
        },

        setSettings(patch) {
          set((s) => ({ settings: { ...s.settings, ...patch } }));
        },

        enqueueAi(job) {
          const exists = get().aiQueue.some((j) => j.noteId === job.noteId && j.action === job.action);
          if (exists) return;
          set((s) => ({ aiQueue: [...s.aiQueue, { ...job, id: uid(), createdAt: Date.now() }] }));
        },
        removeAiJob(id) {
          set((s) => ({ aiQueue: s.aiQueue.filter((j) => j.id !== id) }));
        },

        applyRemote(kind, id, data, deleted, updatedAt) {
          const coll = COLLECTION[kind];
          const local = get()[coll][id] as { updatedAt: number } | undefined;
          // "Última gravação vence": só aplica se a versão da nuvem for mais nova.
          if (local && local.updatedAt >= updatedAt) return;
          const record = { ...(data as object), id, deleted, updatedAt };
          set((s) => {
            const dirty = { ...s.dirty };
            delete dirty[key(kind, id)];
            return { [coll]: { ...s[coll], [id]: record }, dirty } as Partial<State>;
          });
        },
        clearDirty(keys) {
          set((s) => {
            const dirty = { ...s.dirty };
            for (const k of keys) delete dirty[k];
            return { dirty };
          });
        },
        setSyncMeta(patch) {
          set((s) => ({ sync: { ...s.sync, ...patch } }));
        },

        importBackup(data) {
          const toColl = <T extends { id: string }>(arr: T[]) =>
            Object.fromEntries(arr.map((r) => [r.id, r])) as Coll<T>;
          const dirty: Record<string, true> = {};
          data.notebooks.forEach((r) => (dirty[key('notebook', r.id)] = true));
          data.notes.forEach((r) => (dirty[key('note', r.id)] = true));
          data.flashcards.forEach((r) => (dirty[key('flashcard', r.id)] = true));
          data.tasks.forEach((r) => (dirty[key('task', r.id)] = true));
          set((s) => ({
            notebooks: { ...s.notebooks, ...toColl(data.notebooks) },
            notes: { ...s.notes, ...toColl(data.notes) },
            flashcards: { ...s.flashcards, ...toColl(data.flashcards) },
            tasks: { ...s.tasks, ...toColl(data.tasks) },
            settings: data.settings ? { ...DEFAULT_SETTINGS, ...data.settings } : s.settings,
            dirty: { ...s.dirty, ...dirty },
          }));
        },
        resetAll() {
          set({ ...initialState });
        },
      };
    },
    {
      name: 'lumen-store-v1',
      storage: createJSONStorage(() => kvStorage),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          settings: {
            ...DEFAULT_SETTINGS,
            ...p.settings,
            widgets: { ...DEFAULT_SETTINGS.widgets, ...p.settings?.widgets },
          },
        };
      },
    },
  ),
);

/** Lista os registros não excluídos de uma coleção. */
export function alive<T extends { deleted?: boolean }>(coll: Record<string, T>): T[] {
  return Object.values(coll).filter((r) => !r.deleted);
}

/** true quando os dados salvos no aparelho já foram carregados. */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    setHydrated(useStore.persist.hasHydrated());
    return unsub;
  }, []);
  return hydrated;
}
