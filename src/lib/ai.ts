import { FunctionsHttpError } from '@supabase/supabase-js';
import { isOnline } from './sync';
import { useStore } from './store';
import { supabase } from './supabase';
import type { AiAction, AiJob } from './types';

/**
 * Cliente da IA. As chamadas passam pela Edge Function `ai` do Supabase,
 * que guarda a chave da API da Anthropic no servidor (ela nunca fica no app).
 */

interface AiRequest {
  action: AiAction;
  text?: string;
  title?: string;
  imageBase64?: string;
  language: string;
  maxCards?: number;
}

interface AiResponse {
  text?: string;
  cards?: { front: string; back: string }[];
  title?: string;
  error?: string;
}

export class OfflineError extends Error {
  constructor() {
    super('Sem conexão: o pedido foi guardado e será feito quando a internet voltar.');
  }
}

async function call(req: AiRequest): Promise<AiResponse> {
  if (!supabase) throw new Error('A IA precisa do Supabase configurado (veja o README).');
  const { data: auth } = await supabase.auth.getSession();
  if (!auth.session) throw new Error('Entre na sua conta (Ajustes → Conta) para usar a IA.');
  if (!(await isOnline())) throw new OfflineError();

  const { data, error } = await supabase.functions.invoke<AiResponse>('ai', { body: req });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const body = (await error.context.json().catch(() => null)) as AiResponse | null;
      throw new Error(body?.error ?? 'A IA não conseguiu responder agora.');
    }
    throw new Error('Não foi possível falar com a IA. Tente de novo.');
  }
  if (!data) throw new Error('Resposta vazia da IA.');
  if (data.error) throw new Error(data.error);
  return data;
}

function noteText(noteId: string): { title: string; text: string } {
  const n = useStore.getState().notes[noteId];
  if (!n) throw new Error('Nota não encontrada.');
  // O texto lido das fotos já é inserido no conteúdo da nota (editável).
  const text = n.content;
  if (text.trim().length < 20) throw new Error('Escreva, dite ou fotografe um pouco mais de conteúdo antes.');
  return { title: n.title, text };
}

/** Gera e salva o resumo da nota. */
export async function generateSummary(noteId: string) {
  const { title, text } = noteText(noteId);
  const res = await call({ action: 'summary', title, text, language: lang() });
  useStore.getState().updateNote(noteId, { summary: res.text ?? '' });
}

/** Gera e salva o texto de estudo detalhado da nota. */
export async function generateDetailed(noteId: string) {
  const { title, text } = noteText(noteId);
  const res = await call({ action: 'detailed', title, text, language: lang() });
  const s = useStore.getState();
  const note = s.notes[noteId];
  s.updateNote(noteId, {
    detailed: res.text ?? '',
    title: note && !note.title.trim() && res.title ? res.title : note?.title,
  });
}

/** Gera flashcards da nota e os adiciona ao baralho. Retorna quantos foram criados. */
export async function generateFlashcards(noteId: string, maxCards = 15): Promise<number> {
  const { title, text } = noteText(noteId);
  const res = await call({ action: 'flashcards', title, text, language: lang(), maxCards });
  const created = useStore.getState().addFlashcards(res.cards ?? [], noteId);
  return created.length;
}

/** Lê uma foto (anotações à mão, quadro, diagrama) e devolve texto editável em Markdown. */
export async function ocrImage(imageBase64: string): Promise<string> {
  const res = await call({ action: 'ocr', imageBase64, language: lang() });
  return res.text ?? '';
}

const RUNNERS: Record<AiJob['action'], (noteId: string) => Promise<unknown>> = {
  summary: generateSummary,
  detailed: generateDetailed,
  flashcards: (id) => generateFlashcards(id),
};

/**
 * Executa uma ação de IA. Se estiver offline, guarda na fila para depois
 * (assim a sessão de estudo não é interrompida).
 */
export async function runOrQueue(action: AiJob['action'], noteId: string): Promise<'done' | 'queued'> {
  try {
    await RUNNERS[action](noteId);
    return 'done';
  } catch (e) {
    if (e instanceof OfflineError) {
      useStore.getState().enqueueAi({ action, noteId });
      return 'queued';
    }
    throw e;
  }
}

let processing = false;
/** Processa os pedidos de IA guardados enquanto estava offline. */
export async function processAiQueue(): Promise<number> {
  if (processing) return 0;
  processing = true;
  let done = 0;
  try {
    for (const job of [...useStore.getState().aiQueue]) {
      try {
        await RUNNERS[job.action](job.noteId);
        useStore.getState().removeAiJob(job.id);
        done++;
      } catch (e) {
        if (e instanceof OfflineError) break;
        // erro definitivo (ex.: nota apagada): descarta o pedido
        useStore.getState().removeAiJob(job.id);
      }
    }
  } finally {
    processing = false;
  }
  return done;
}

function lang() {
  return useStore.getState().settings.aiLanguage;
}

export const AI_LABEL: Record<AiJob['action'], string> = {
  summary: 'Resumo',
  detailed: 'Texto detalhado',
  flashcards: 'Flashcards',
};
