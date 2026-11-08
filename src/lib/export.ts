import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { marked } from 'marked';
import { Platform } from 'react-native';
import { readAsBase64 } from './attachments';
import { alive, useStore, type BackupFile } from './store';
import type { Flashcard, Note } from './types';

/**
 * Exportação para vários formatos e backup/restauração completos.
 * Os arquivos são gerados no cache do app e abertos na folha de compartilhamento
 * do sistema (salvar em Arquivos, enviar por e-mail, AirDrop, Google Drive...).
 */

export type NoteFormat = 'md' | 'txt' | 'html' | 'pdf' | 'json';
export type CardsFormat = 'csv' | 'tsv' | 'json';

export const NOTE_FORMATS: { id: NoteFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'md', label: 'Markdown (.md)' },
  { id: 'txt', label: 'Texto (.txt)' },
  { id: 'html', label: 'Página web (.html)' },
  { id: 'json', label: 'JSON' },
];

const MIME: Record<string, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  html: 'text/html',
  json: 'application/json',
  csv: 'text/csv',
  tsv: 'text/tab-separated-values',
  pdf: 'application/pdf',
};

function safeName(s: string) {
  return (s || 'nota').replace(/[^\p{L}\p{N}\- _]+/gu, '').trim().slice(0, 60) || 'nota';
}

/** Monta o Markdown completo da nota (conteúdo + resumo + texto detalhado + flashcards). */
export function noteToMarkdown(note: Note, cards: Flashcard[] = []): string {
  const parts = [`# ${note.title || 'Sem título'}`];
  if (note.tags.length) parts.push(note.tags.map((t) => `#${t}`).join(' '));
  if (note.content.trim()) parts.push(note.content.trim());
  if (note.summary?.trim()) parts.push('## Resumo', note.summary.trim());
  if (note.detailed?.trim()) parts.push('## Texto detalhado', note.detailed.trim());
  if (cards.length) {
    parts.push('## Flashcards', cards.map((c) => `- **${c.front.replace(/\n/g, ' ')}** — ${c.back.replace(/\n/g, ' ')}`).join('\n'));
  }
  return parts.join('\n\n') + '\n';
}

function stripMarkdown(md: string): string {
  return md
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```\w*\n?/g, ''))
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__|\*|_|~~|`)/g, '')
    .replace(/^>\s?/gm, '')
    .replace(/^- \[( |x)\] /gm, (_m, x) => (x === 'x' ? '☑ ' : '☐ '))
    .trim();
}

const HTML_STYLE = `
  body{font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:760px;margin:32px auto;padding:0 20px;line-height:1.6;color:#14161a}
  h1{font-size:28px;margin-bottom:4px} h2{margin-top:32px;border-bottom:1px solid #e4e5e9;padding-bottom:4px}
  pre,code{background:#f0f1f3;border-radius:6px} pre{padding:12px;overflow:auto} code{padding:2px 4px}
  blockquote{border-left:4px solid #6366f1;margin:0;padding-left:12px;color:#555}
  img{max-width:100%;border-radius:8px;margin:8px 0} table{border-collapse:collapse} td,th{border:1px solid #ddd;padding:6px}`;

async function noteToHtml(note: Note, cards: Flashcard[], embedImages: boolean): Promise<string> {
  let body = await marked.parse(noteToMarkdown(note, cards));
  if (embedImages && Platform.OS !== 'web') {
    const imgs: string[] = [];
    for (const a of note.attachments) {
      if (!a.localUri) continue;
      try {
        imgs.push(`<img src="data:image/jpeg;base64,${await readAsBase64(a.localUri)}"/>`);
      } catch {
        // foto indisponível neste aparelho
      }
    }
    if (imgs.length) body += `<h2>Fotos</h2>${imgs.join('')}`;
  }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(note.title || 'Nota')}</title><style>${HTML_STYLE}</style></head><body>${body}</body></html>`;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

async function shareText(filename: string, content: string, ext: string) {
  if (Platform.OS === 'web') {
    const blob = new Blob([content], { type: MIME[ext] });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  await Sharing.shareAsync(file.uri, { mimeType: MIME[ext], dialogTitle: filename });
}

export async function exportNote(noteId: string, format: NoteFormat) {
  const s = useStore.getState();
  const note = s.notes[noteId];
  if (!note) throw new Error('Nota não encontrada.');
  const cards = alive(s.flashcards).filter((c) => c.noteId === noteId);
  const base = safeName(note.title);

  switch (format) {
    case 'md':
      return shareText(`${base}.md`, noteToMarkdown(note, cards), 'md');
    case 'txt':
      return shareText(`${base}.txt`, stripMarkdown(noteToMarkdown(note, cards)), 'txt');
    case 'html':
      return shareText(`${base}.html`, await noteToHtml(note, cards, true), 'html');
    case 'json':
      return shareText(`${base}.json`, JSON.stringify({ note, flashcards: cards }, null, 2), 'json');
    case 'pdf': {
      const html = await noteToHtml(note, cards, true);
      if (Platform.OS === 'web') return Print.printAsync({ html });
      const { uri } = await Print.printToFileAsync({ html });
      const dest = new File(Paths.cache, `${base}.pdf`);
      if (dest.exists) dest.delete();
      new File(uri).moveSync(dest);
      return Sharing.shareAsync(dest.uri, { mimeType: MIME.pdf, UTI: 'com.adobe.pdf', dialogTitle: `${base}.pdf` });
    }
  }
}

function csvCell(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

/** Exporta flashcards. CSV/TSV podem ser importados no Anki, Quizlet e planilhas. */
export async function exportFlashcards(format: CardsFormat, noteId?: string) {
  const s = useStore.getState();
  const cards = alive(s.flashcards).filter((c) => !noteId || c.noteId === noteId);
  if (!cards.length) throw new Error('Não há flashcards para exportar.');
  const base = noteId ? `flashcards-${safeName(s.notes[noteId]?.title ?? '')}` : 'flashcards';
  if (format === 'json') return shareText(`${base}.json`, JSON.stringify(cards, null, 2), 'json');
  const sep = format === 'csv' ? ',' : '\t';
  const rows = cards.map((c) =>
    format === 'csv'
      ? [csvCell(c.front), csvCell(c.back)].join(sep)
      : [c.front, c.back].map((x) => x.replace(/[\t\n]+/g, ' ')).join(sep),
  );
  return shareText(`${base}.${format}`, rows.join('\n') + '\n', format);
}

export function buildBackup(): BackupFile {
  const s = useStore.getState();
  return {
    app: 'lumen',
    version: 1,
    exportedAt: new Date().toISOString(),
    notebooks: Object.values(s.notebooks),
    notes: Object.values(s.notes).map((n) => ({
      ...n,
      attachments: n.attachments.map(({ localUri: _l, ...a }) => a),
    })),
    flashcards: Object.values(s.flashcards),
    tasks: Object.values(s.tasks),
    settings: s.settings,
  };
}

/** Backup completo em um arquivo JSON (complementa o backup automático na nuvem). */
export async function exportBackup() {
  const date = new Date().toISOString().slice(0, 10);
  return shareText(`lumen-backup-${date}.json`, JSON.stringify(buildBackup(), null, 2), 'json');
}

/** Restaura um backup JSON. Registros existentes com o mesmo id são substituídos. */
export async function importBackupFromFile(): Promise<number | null> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
  if (res.canceled || !res.assets?.[0]) return null;
  const asset = res.assets[0];
  const text = Platform.OS === 'web' && asset.file ? await asset.file.text() : await new File(asset.uri).text();
  let data: BackupFile;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Arquivo inválido: não é um JSON.');
  }
  if (data?.app !== 'lumen' || !Array.isArray(data.notes)) throw new Error('Este arquivo não é um backup do Lumen.');
  useStore.getState().importBackup({
    ...data,
    notebooks: data.notebooks ?? [],
    flashcards: data.flashcards ?? [],
    tasks: data.tasks ?? [],
  });
  return data.notes.length;
}
