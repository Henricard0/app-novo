/**
 * Modelo de dados do app. Tudo é salvo localmente primeiro (offline-first)
 * e sincronizado com a nuvem quando houver conexão e conta conectada.
 *
 * Toda entidade sincronizável tem `id`, `updatedAt` (ms) e `deleted`
 * (exclusão lógica, para que a exclusão também chegue aos outros aparelhos).
 */

export type SyncKind = 'notebook' | 'note' | 'flashcard' | 'task';

export interface BaseRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted?: boolean;
}

export interface Notebook extends BaseRecord {
  name: string;
  emoji: string;
  color: string;
}

export interface Attachment {
  id: string;
  /** Caminho local (pasta de documentos do app). Pode faltar em outro aparelho até ser baixado. */
  localUri?: string;
  /** Caminho no Supabase Storage, preenchido após o backup. */
  remotePath?: string;
  width?: number;
  height?: number;
  createdAt: number;
  /** Texto extraído pela IA (OCR); também é inserido no conteúdo da nota. */
  ocrText?: string;
}

export interface Note extends BaseRecord {
  notebookId: string | null;
  title: string;
  /** Conteúdo principal em Markdown (transcrição, ditado, anotações). */
  content: string;
  /** Resumo gerado por IA (Markdown). */
  summary?: string;
  /** Texto de estudo detalhado gerado por IA (Markdown). */
  detailed?: string;
  attachments: Attachment[];
  tags: string[];
  pinned?: boolean;
}

export interface Flashcard extends BaseRecord {
  noteId: string | null;
  front: string;
  back: string;
  /** Campos do algoritmo de repetição espaçada (SM-2). */
  ease: number;
  interval: number;
  repetitions: number;
  dueAt: number;
  lastReviewedAt?: number;
}

export interface Task extends BaseRecord {
  title: string;
  details?: string;
  dueAt: number | null;
  done: boolean;
  noteId?: string | null;
  priority: 'low' | 'normal' | 'high';
}

export type ThemeMode = 'system' | 'light' | 'dark';
export type EditorFont = 'sans' | 'serif' | 'mono';

export interface DashboardWidgets {
  stats: boolean;
  review: boolean;
  tasks: boolean;
  recent: boolean;
  quickActions: boolean;
}

export interface Settings {
  themeMode: ThemeMode;
  accent: string;
  fontScale: number;
  editorFont: EditorFont;
  /** Começa a nota em modo de leitura (Markdown renderizado) em vez de edição. */
  openNotesInPreview: boolean;
  speechLang: string;
  aiLanguage: string;
  notificationsEnabled: boolean;
  /** Horário do lembrete diário de estudo, "HH:MM". */
  dailyReminderTime: string;
  /** Minutos antes do prazo para avisar de uma tarefa. */
  taskReminderOffsetMin: number;
  autoSync: boolean;
  widgets: DashboardWidgets;
  userName: string;
}

export type AiAction = 'summary' | 'detailed' | 'flashcards' | 'ocr';

export interface AiJob {
  id: string;
  action: Exclude<AiAction, 'ocr'>;
  noteId: string;
  createdAt: number;
  error?: string;
}
