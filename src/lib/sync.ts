import NetInfo from '@react-native-community/netinfo';
import { downloadTo, localExists, readBytes } from './attachments';
import { COLLECTION, useStore } from './store';
import { ATTACHMENTS_BUCKET, supabase } from './supabase';
import type { Attachment, Note, SyncKind } from './types';

/**
 * Sincronização multiplataforma (iPhone, Android e web) via Supabase.
 *
 * Estratégia "offline-first":
 *  1. Tudo é gravado primeiro no aparelho e marcado como "pendente".
 *  2. Ao sincronizar, primeiro BAIXAMOS o que mudou na nuvem desde a última vez
 *     (a versão mais recente de cada registro vence).
 *  3. Depois ENVIAMOS os pendentes (fotos vão para o Storage, dados para a tabela).
 *
 * Os dados ficam na tabela `records` (um JSON por registro), protegida por RLS:
 * cada usuário só enxerga as próprias linhas.
 */

interface RemoteRow {
  id: string;
  kind: SyncKind;
  data: Record<string, unknown>;
  deleted: boolean;
  updated_at: string;
  server_updated_at: string;
}

const PAGE = 500;
let running: Promise<SyncResult> | null = null;

export interface SyncResult {
  pulled: number;
  pushed: number;
}

export async function isOnline(): Promise<boolean> {
  const s = await NetInfo.fetch();
  return Boolean(s.isConnected && s.isInternetReachable !== false);
}

/** Executa uma sincronização completa. Chamadas simultâneas reaproveitam a mesma execução. */
export function syncNow(): Promise<SyncResult> {
  if (!running) {
    running = doSync().finally(() => {
      running = null;
    });
  }
  return running;
}

async function doSync(): Promise<SyncResult> {
  const store = useStore.getState();
  if (!supabase) throw new Error('Nuvem não configurada (veja o README).');
  const { data: auth } = await supabase.auth.getSession();
  const user = auth.session?.user;
  if (!user) throw new Error('Entre na sua conta para sincronizar.');
  if (!(await isOnline())) throw new Error('Sem conexão. Seus dados estão salvos no aparelho.');

  try {
    const pulled = await pull();
    await downloadMissingAttachments();
    const pushed = await push(user.id);
    store.setSyncMeta({ lastSyncAt: Date.now(), lastError: null });
    return { pulled, pushed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    store.setSyncMeta({ lastError: msg });
    throw e;
  }
}

async function pull(): Promise<number> {
  let count = 0;
  for (;;) {
    const { lastPulledAt } = useStore.getState().sync;
    let q = supabase!
      .from('records')
      .select('id, kind, data, deleted, updated_at, server_updated_at')
      .order('server_updated_at', { ascending: true })
      .limit(PAGE);
    if (lastPulledAt) q = q.gt('server_updated_at', lastPulledAt);
    const { data, error } = await q;
    if (error) throw new Error(`Erro ao baixar dados: ${error.message}`);
    const rows = (data ?? []) as RemoteRow[];

    for (const row of rows) {
      let payload = row.data;
      if (row.kind === 'note') payload = mergeLocalAttachmentUris(row.id, payload as unknown as Note) as never;
      useStore.getState().applyRemote(row.kind, row.id, payload, row.deleted, Date.parse(row.updated_at));
      count++;
    }
    if (rows.length) useStore.getState().setSyncMeta({ lastPulledAt: rows[rows.length - 1].server_updated_at });
    if (rows.length < PAGE) return count;
  }
}

/** O caminho local de uma foto só vale no aparelho que a tirou: preserva o nosso. */
function mergeLocalAttachmentUris(noteId: string, remote: Note): Note {
  const local = useStore.getState().notes[noteId];
  const byId = new Map(local?.attachments.map((a) => [a.id, a.localUri]) ?? []);
  return {
    ...remote,
    attachments: (remote.attachments ?? []).map((a) => ({ ...a, localUri: byId.get(a.id) })),
  };
}

async function downloadMissingAttachments() {
  const notes = Object.values(useStore.getState().notes).filter((n) => !n.deleted);
  for (const note of notes) {
    for (const att of note.attachments) {
      if (!att.remotePath || localExists(att.localUri)) continue;
      const { data, error } = await supabase!.storage
        .from(ATTACHMENTS_BUCKET)
        .createSignedUrl(att.remotePath, 600);
      if (error || !data) continue;
      try {
        const uri = await downloadTo(data.signedUrl, att.id);
        patchAttachmentSilently(note.id, att.id, { localUri: uri });
      } catch {
        // tenta de novo na próxima sincronização
      }
    }
  }
}

/** Atualiza o caminho local sem marcar a nota como alterada (não precisa reenviar). */
function patchAttachmentSilently(noteId: string, attId: string, patch: Partial<Attachment>) {
  useStore.setState((s) => {
    const n = s.notes[noteId];
    if (!n) return {};
    return {
      notes: {
        ...s.notes,
        [noteId]: { ...n, attachments: n.attachments.map((a) => (a.id === attId ? { ...a, ...patch } : a)) },
      },
    };
  });
}

async function uploadPendingAttachments(userId: string, note: Note): Promise<Note> {
  let changed = false;
  const attachments: Attachment[] = [];
  for (const att of note.attachments) {
    if (att.remotePath || !att.localUri || !localExists(att.localUri)) {
      attachments.push(att);
      continue;
    }
    const path = `${userId}/${note.id}/${att.id}.jpg`;
    const bytes = await readBytes(att.localUri);
    const { error } = await supabase!.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
    if (error) throw new Error(`Erro ao enviar foto: ${error.message}`);
    attachments.push({ ...att, remotePath: path });
    changed = true;
  }
  if (!changed) return note;
  patchNoteSilently(note.id, { attachments });
  return { ...note, attachments };
}

function patchNoteSilently(noteId: string, patch: Partial<Note>) {
  useStore.setState((s) => {
    const n = s.notes[noteId];
    return n ? { notes: { ...s.notes, [noteId]: { ...n, ...patch } } } : {};
  });
}

async function push(userId: string): Promise<number> {
  const state = useStore.getState();
  const keys = Object.keys(state.dirty);
  if (!keys.length) return 0;

  const rows: Array<Record<string, unknown>> = [];
  const sent: string[] = [];
  for (const k of keys) {
    const [kind, id] = k.split(':') as [SyncKind, string];
    const coll = COLLECTION[kind];
    let record = useStore.getState()[coll][id] as unknown as Record<string, unknown> | undefined;
    if (!record) {
      sent.push(k);
      continue;
    }
    if (kind === 'note' && !record.deleted) {
      record = (await uploadPendingAttachments(userId, record as unknown as Note)) as unknown as Record<
        string,
        unknown
      >;
    }
    const { id: _id, updatedAt, deleted, ...data } = record;
    if (kind === 'note') {
      // não enviamos caminhos locais (só valem neste aparelho)
      data.attachments = ((data.attachments as Attachment[]) ?? []).map(({ localUri: _l, ...a }) => a);
    }
    rows.push({
      user_id: userId,
      kind,
      id,
      data,
      deleted: Boolean(deleted),
      updated_at: new Date(updatedAt as number).toISOString(),
    });
    sent.push(k);
  }

  for (let i = 0; i < rows.length; i += PAGE) {
    const { error } = await supabase!
      .from('records')
      .upsert(rows.slice(i, i + PAGE), { onConflict: 'user_id,kind,id' });
    if (error) throw new Error(`Erro ao enviar dados: ${error.message}`);
  }

  // Só limpa o "pendente" se o registro não mudou de novo durante o envio.
  const after = useStore.getState();
  const stillSame = sent.filter((k) => {
    const [kind, id] = k.split(':') as [SyncKind, string];
    const now = after[COLLECTION[kind]][id] as { updatedAt: number } | undefined;
    const row = rows.find((r) => r.kind === kind && r.id === id);
    return !row || !now || new Date(row.updated_at as string).getTime() === now.updatedAt;
  });
  after.clearDirty(stillSame);
  return rows.length;
}
