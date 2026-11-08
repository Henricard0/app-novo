import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MarkdownEditor, type MarkdownEditorHandle } from '../../components/MarkdownEditor';
import { MarkdownView } from '../../components/MarkdownView';
import { Button, Card, Chip, Empty, IconButton, Input, Row, Sheet, T, type SheetOption } from '../../components/ui';
import { AI_LABEL, ocrImage, runOrQueue } from '../../lib/ai';
import { confirm, errorMessage, notify } from '../../lib/alert';
import { deleteLocal, pickPhoto, readAsBase64, type PhotoSource } from '../../lib/attachments';
import { exportFlashcards, exportNote, NOTE_FORMATS } from '../../lib/export';
import { appendDictation, useDictation } from '../../lib/speech';
import { alive, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import type { AiJob, Attachment, Flashcard } from '../../lib/types';

type Tab = 'note' | 'summary' | 'detailed' | 'cards';

const SAVE_DELAY = 500;

export default function NoteScreen() {
  const { id, start } = useLocalSearchParams<{ id: string; start?: 'dictate' | 'photo' }>();
  const t = useTheme();
  const note = useStore((s) => s.notes[id]);
  const notebooksColl = useStore((s) => s.notebooks);
  const cardsColl = useStore((s) => s.flashcards);
  const openInPreview = useStore((s) => s.settings.openNotesInPreview);
  const queued = useStore((s) => s.aiQueue.filter((j) => j.noteId === id).map((j) => j.action).join(','));

  const [tab, setTab] = useState<Tab>('note');
  const [preview, setPreview] = useState(openInPreview && !!note?.content);
  const [title, setTitle] = useState(note?.title ?? '');
  const [content, setContent] = useState(note?.content ?? '');
  const [tagsText, setTagsText] = useState(note?.tags.join(', ') ?? '');
  const [busy, setBusy] = useState<AiJob['action'] | 'ocr' | null>(null);
  const [sheet, setSheet] = useState<'photo' | 'export' | 'ai' | 'notebook' | 'more' | null>(null);
  const [viewer, setViewer] = useState<Attachment | null>(null);
  const [editCard, setEditCard] = useState<Partial<Flashcard> | null>(null);
  const editor = useRef<MarkdownEditorHandle>(null);

  // ---- salvamento automático (com pequeno atraso para não gravar a cada tecla)
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (Object.keys(pending.current).length && useStore.getState().notes[id]) {
      useStore.getState().updateNote(id, pending.current);
    }
    pending.current = {};
  }, [id]);
  const queueSave = (patch: { title?: string; content?: string }) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY);
  };
  useEffect(() => () => flush(), [flush]);

  const changeContent = (text: string) => {
    setContent(text);
    queueSave({ content: text });
  };
  const changeTitle = (text: string) => {
    setTitle(text);
    queueSave({ title: text });
  };

  // Recebe atualizações vindas da sincronização (outro aparelho), se não estiver editando.
  useEffect(() => {
    if (!note || Object.keys(pending.current).length) return;
    setTitle(note.title);
    setContent(note.content);
  }, [note?.title, note?.content]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- ditado
  const contentRef = useRef(content);
  contentRef.current = content;
  const dictation = useDictation((piece) => {
    if (editor.current && !preview) editor.current.insertAtCursor(piece);
    else changeContent(appendDictation(contentRef.current, piece));
  });
  useEffect(() => {
    if (dictation.error) notify('Ditado', dictation.error);
  }, [dictation.error]);

  // ---- ações iniciais vindas do painel ("Ditar" / "Foto")
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !note) return;
    started.current = true;
    if (start === 'dictate') void dictation.start();
    if (start === 'photo') setSheet('photo');
  }, [start, note, dictation]);

  const cards = useMemo(
    () => alive(cardsColl).filter((c) => c.noteId === id).sort((a, b) => a.createdAt - b.createdAt),
    [cardsColl, id],
  );

  if (!note || note.deleted) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
        <Empty icon="document-outline" title="Nota não encontrada" hint="Ela pode ter sido excluída em outro aparelho." />
      </SafeAreaView>
    );
  }

  const notebook = note.notebookId ? notebooksColl[note.notebookId] : undefined;

  // ---- IA
  const runAi = async (action: AiJob['action']) => {
    flush();
    setBusy(action);
    try {
      const res = await runOrQueue(action, id);
      if (res === 'queued') {
        notify('Sem conexão', `"${AI_LABEL[action]}" será gerado automaticamente quando a internet voltar.`);
      } else {
        setTab(action === 'summary' ? 'summary' : action === 'detailed' ? 'detailed' : 'cards');
      }
    } catch (e) {
      notify('IA', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  // ---- fotos
  const addPhoto = async (source: PhotoSource) => {
    try {
      const att = await pickPhoto(source);
      if (!att) return;
      useStore.getState().addAttachment(id, att);
      confirmOcr(att);
    } catch (e) {
      notify('Foto', errorMessage(e));
    }
  };

  const confirmOcr = (att: Attachment) => {
    confirm(
      'Transformar a foto em texto?',
      'A IA lê a escrita à mão e os diagramas e insere o conteúdo na nota, pronto para editar.',
      'Ler com IA',
      () => void runOcr(att),
    );
  };

  const runOcr = async (att: Attachment) => {
    if (!att.localUri) return;
    setBusy('ocr');
    try {
      const text = await ocrImage(await readAsBase64(att.localUri));
      if (!text.trim()) throw new Error('Não encontrei texto nesta foto.');
      useStore.getState().updateAttachment(id, att.id, { ocrText: text });
      const block = `\n\n${text.trim()}\n`;
      setTab('note');
      changeContent(contentRef.current.trimEnd() + block);
      flush();
    } catch (e) {
      notify('Leitura da foto', errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const removePhoto = (att: Attachment) =>
    confirm('Remover foto?', 'O texto já inserido na nota continua lá.', 'Remover', () => {
      useStore.getState().removeAttachment(id, att.id);
      deleteLocal(att.localUri);
      setViewer(null);
    });

  const saveTags = () => {
    const tags = tagsText
      .split(/[,#]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    useStore.getState().updateNote(id, { tags: Array.from(new Set(tags)) });
  };

  const doExport = async (fn: () => Promise<unknown>) => {
    flush();
    try {
      await fn();
    } catch (e) {
      notify('Exportar', errorMessage(e));
    }
  };

  const aiOptions: SheetOption[] = [
    { label: 'Gerar resumo', icon: 'sparkles-outline', hint: 'Os pontos principais em poucos tópicos', onPress: () => void runAi('summary') },
    {
      label: 'Gerar texto detalhado',
      icon: 'book-outline',
      hint: 'Um texto de estudo completo, organizado e explicado',
      onPress: () => void runAi('detailed'),
    },
    { label: 'Gerar flashcards', icon: 'albums-outline', hint: 'Perguntas e respostas para revisar', onPress: () => void runAi('flashcards') },
  ];

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <Row style={{ gap: 0 }}>
              <IconButton
                icon={dictation.listening ? 'stop-circle' : 'mic-outline'}
                color={dictation.listening ? t.danger : undefined}
                label={dictation.listening ? 'Parar ditado' : 'Ditar'}
                onPress={() => (dictation.listening ? dictation.stop() : void dictation.start())}
              />
              <IconButton icon="camera-outline" label="Adicionar foto" onPress={() => setSheet('photo')} />
              <IconButton icon="sparkles-outline" label="IA" onPress={() => setSheet('ai')} />
              <IconButton icon="ellipsis-horizontal-circle-outline" label="Mais opções" onPress={() => setSheet('more')} />
            </Row>
          ),
        }}
      />

      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 120 }}>
        <TextInput
          value={title}
          onChangeText={changeTitle}
          placeholder="Título"
          placeholderTextColor={t.textMuted}
          style={{ fontSize: 26 * t.fontScale, fontWeight: '800', color: t.text }}
        />
        <Row style={{ flexWrap: 'wrap' }}>
          <Chip label={notebook && !notebook.deleted ? `${notebook.emoji} ${notebook.name}` : '📂 Sem caderno'} onPress={() => setSheet('notebook')} />
          <TextInput
            value={tagsText}
            onChangeText={setTagsText}
            onBlur={saveTags}
            placeholder="tags, separadas, por vírgula"
            placeholderTextColor={t.textMuted}
            style={{ color: t.accent, fontSize: 13 * t.fontScale, flex: 1, minWidth: 140 }}
          />
        </Row>

        <Row style={{ backgroundColor: t.surfaceAlt, borderRadius: 12, padding: 4, gap: 4 }}>
          {(
            [
              ['note', 'Nota'],
              ['summary', 'Resumo'],
              ['detailed', 'Detalhado'],
              ['cards', `Cartões${cards.length ? ` (${cards.length})` : ''}`],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <Pressable
              key={k}
              onPress={() => {
                flush();
                setTab(k);
              }}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 9,
                alignItems: 'center',
                backgroundColor: tab === k ? t.surface : 'transparent',
              }}
            >
              <T size={13} weight={tab === k ? '700' : '500'} color={tab === k ? t.text : t.textMuted} numberOfLines={1}>
                {label}
              </T>
            </Pressable>
          ))}
        </Row>

        {busy ? (
          <Card style={{ backgroundColor: t.accentSoft, borderColor: t.accentSoft }}>
            <Row>
              <Ionicons name="sparkles" size={18} color={t.accent} />
              <T color={t.accent} weight="600">
                {busy === 'ocr' ? 'Lendo a foto…' : `Gerando ${AI_LABEL[busy].toLowerCase()}…`}
              </T>
            </Row>
          </Card>
        ) : null}
        {queued ? (
          <T size={12} color={t.warning}>
            Aguardando conexão para: {queued.split(',').map((a) => AI_LABEL[a as AiJob['action']]).join(', ')}
          </T>
        ) : null}

        {tab === 'note' ? (
          <>
            {dictation.listening ? (
              <Card style={{ borderColor: t.danger }}>
                <Row>
                  <Ionicons name="radio-button-on" size={16} color={t.danger} />
                  <T weight="600" color={t.danger} style={{ flex: 1 }}>
                    Ouvindo… fale normalmente
                  </T>
                  <Button small variant="danger" title="Parar" onPress={dictation.stop} />
                </Row>
                {dictation.interim ? (
                  <T muted style={{ marginTop: 8, fontStyle: 'italic' }}>
                    {dictation.interim}
                  </T>
                ) : null}
              </Card>
            ) : null}

            <Row style={{ justifyContent: 'flex-end' }}>
              <Chip label={preview ? '✏️ Editar' : '👁 Visualizar'} onPress={() => (flush(), setPreview((p) => !p))} />
            </Row>
            {preview ? (
              <Pressable onPress={() => setPreview(false)}>
                <MarkdownView value={content} />
              </Pressable>
            ) : (
              <MarkdownEditor
                ref={editor}
                value={content}
                onChange={changeContent}
                placeholder={'Escreva, dite 🎤 ou fotografe 📷 suas anotações.\n\nSuporta Markdown: # títulos, **negrito**, listas, - [ ] tarefas…'}
              />
            )}

            {note.attachments.length ? (
              <View style={{ gap: 8 }}>
                <T size={13} weight="700" muted>
                  FOTOS
                </T>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                  {note.attachments.map((a) => (
                    <Pressable key={a.id} onPress={() => setViewer(a)}>
                      {a.localUri ? (
                        <Image source={{ uri: a.localUri }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                      ) : (
                        <View
                          style={{
                            width: 120,
                            height: 120,
                            borderRadius: 12,
                            backgroundColor: t.surfaceAlt,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Ionicons name="cloud-download-outline" size={24} color={t.textMuted} />
                        </View>
                      )}
                      {a.ocrText ? (
                        <View style={{ position: 'absolute', right: 6, top: 6, backgroundColor: t.accent, borderRadius: 8, padding: 3 }}>
                          <Ionicons name="text" size={12} color={t.onAccent} />
                        </View>
                      ) : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        ) : null}

        {tab === 'summary' ? (
          <AiSection
            value={note.summary}
            emptyTitle="Ainda sem resumo"
            emptyHint="A IA lê sua nota e destaca os pontos principais."
            buttonLabel="Gerar resumo com IA"
            busy={busy === 'summary'}
            onGenerate={() => void runAi('summary')}
            onEdit={(text) => useStore.getState().updateNote(id, { summary: text })}
          />
        ) : null}

        {tab === 'detailed' ? (
          <AiSection
            value={note.detailed}
            emptyTitle="Ainda sem texto detalhado"
            emptyHint="A IA transforma suas anotações em um texto de estudo completo, com explicações e exemplos."
            buttonLabel="Gerar texto detalhado com IA"
            busy={busy === 'detailed'}
            onGenerate={() => void runAi('detailed')}
            onEdit={(text) => useStore.getState().updateNote(id, { detailed: text })}
          />
        ) : null}

        {tab === 'cards' ? (
          <View style={{ gap: 10 }}>
            <Row>
              <Button
                style={{ flex: 1 }}
                icon="sparkles-outline"
                title="Gerar com IA"
                loading={busy === 'flashcards'}
                onPress={() => void runAi('flashcards')}
              />
              <Button style={{ flex: 1 }} variant="soft" icon="add" title="Manual" onPress={() => setEditCard({ front: '', back: '' })} />
            </Row>
            {cards.length ? (
              <Button
                variant="soft"
                icon="play-outline"
                title="Revisar os cartões desta nota"
                onPress={() => router.push({ pathname: '/review', params: { noteId: id, all: '1' } })}
              />
            ) : (
              <Empty icon="albums-outline" title="Nenhum flashcard" hint="Gere com IA ou crie manualmente." />
            )}
            {cards.map((c) => (
              <Card key={c.id} onPress={() => setEditCard(c)} style={{ gap: 6 }}>
                <T weight="700">{c.front}</T>
                <T muted size={14}>
                  {c.back}
                </T>
              </Card>
            ))}
          </View>
        ) : null}
      </ScrollView>

      {/* ---- folhas de opções ---- */}
      <Sheet
        visible={sheet === 'photo'}
        onClose={() => setSheet(null)}
        title="Adicionar foto"
        options={[
          { label: 'Tirar foto', icon: 'camera-outline', hint: 'Caderno, quadro, diagrama feito à mão', onPress: () => void addPhoto('camera') },
          { label: 'Escolher da galeria', icon: 'images-outline', onPress: () => void addPhoto('library') },
        ]}
      />
      <Sheet visible={sheet === 'ai'} onClose={() => setSheet(null)} title="Inteligência artificial" options={aiOptions} />
      <Sheet
        visible={sheet === 'export'}
        onClose={() => setSheet(null)}
        title="Exportar nota"
        options={[
          ...NOTE_FORMATS.map((f) => ({
            label: f.label,
            icon: 'document-outline' as const,
            onPress: () => void doExport(() => exportNote(id, f.id)),
          })),
          ...(cards.length
            ? [
                {
                  label: 'Flashcards em CSV (Anki/Quizlet)',
                  icon: 'albums-outline' as const,
                  onPress: () => void doExport(() => exportFlashcards('csv', id)),
                },
              ]
            : []),
        ]}
      />
      <Sheet
        visible={sheet === 'notebook'}
        onClose={() => setSheet(null)}
        title="Caderno"
        options={[
          ...alive(notebooksColl).map((nb) => ({
            label: `${nb.emoji} ${nb.name}`,
            onPress: () => useStore.getState().updateNote(id, { notebookId: nb.id }),
          })),
          { label: 'Sem caderno', icon: 'remove-circle-outline', onPress: () => useStore.getState().updateNote(id, { notebookId: null }) },
        ]}
      />
      <Sheet
        visible={sheet === 'more'}
        onClose={() => setSheet(null)}
        options={[
          { label: 'Exportar…', icon: 'share-outline', onPress: () => setTimeout(() => setSheet('export'), 350) },
          {
            label: note.pinned ? 'Desafixar' : 'Fixar no topo',
            icon: 'pin-outline',
            onPress: () => useStore.getState().updateNote(id, { pinned: !note.pinned }),
          },
          {
            label: 'Criar tarefa a partir desta nota',
            icon: 'checkmark-circle-outline',
            onPress: () => {
              useStore.getState().upsertTask({ title: `Estudar: ${title || 'nota sem título'}`, noteId: id });
              notify('Tarefa criada', 'Defina o prazo na aba Tarefas.');
            },
          },
          {
            label: 'Excluir nota',
            icon: 'trash-outline',
            destructive: true,
            onPress: () =>
              confirm('Excluir nota?', 'Os flashcards desta nota também serão excluídos.', 'Excluir', () => {
                pending.current = {};
                useStore.getState().deleteNote(id);
                router.back();
              }),
          },
        ]}
      />

      {/* ---- visualizador de foto ---- */}
      <Modal visible={!!viewer} animationType="fade" onRequestClose={() => setViewer(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          <Row style={{ justifyContent: 'space-between', padding: 8 }}>
            <IconButton icon="close" color="#fff" label="Fechar" onPress={() => setViewer(null)} />
            <Row>
              <Button
                small
                variant="soft"
                icon="text-outline"
                title={viewer?.ocrText ? 'Ler de novo' : 'Ler texto com IA'}
                onPress={() => {
                  const a = viewer;
                  setViewer(null);
                  if (a) void runOcr(a);
                }}
              />
              <IconButton icon="trash-outline" color="#fff" label="Remover foto" onPress={() => viewer && removePhoto(viewer)} />
            </Row>
          </Row>
          {viewer?.localUri ? (
            <Image source={{ uri: viewer.localUri }} style={{ flex: 1 }} resizeMode="contain" />
          ) : (
            <Empty icon="cloud-download-outline" title="Foto ainda não baixada" hint="Sincronize para baixar." />
          )}
        </SafeAreaView>
      </Modal>

      {/* ---- edição de flashcard ---- */}
      <Sheet visible={!!editCard} onClose={() => setEditCard(null)} title={editCard?.id ? 'Editar flashcard' : 'Novo flashcard'}>
        {editCard ? (
          <View style={{ gap: 12 }}>
            <Input
              label="Frente (pergunta)"
              multiline
              value={editCard.front}
              onChangeText={(front) => setEditCard({ ...editCard, front })}
            />
            <Input
              label="Verso (resposta)"
              multiline
              value={editCard.back}
              onChangeText={(back) => setEditCard({ ...editCard, back })}
            />
            <Button
              title="Salvar"
              disabled={!editCard.front?.trim() || !editCard.back?.trim()}
              onPress={() => {
                const s = useStore.getState();
                if (editCard.id) s.updateFlashcard(editCard.id, { front: editCard.front, back: editCard.back });
                else s.addFlashcards([{ front: editCard.front!, back: editCard.back! }], id);
                setEditCard(null);
              }}
            />
            {editCard.id ? (
              <Button
                variant="ghost"
                title="Excluir flashcard"
                onPress={() => {
                  useStore.getState().deleteFlashcard(editCard.id!);
                  setEditCard(null);
                }}
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}

/** Aba de conteúdo gerado por IA (resumo / texto detalhado), também editável. */
function AiSection({
  value,
  emptyTitle,
  emptyHint,
  buttonLabel,
  busy,
  onGenerate,
  onEdit,
}: {
  value?: string;
  emptyTitle: string;
  emptyHint: string;
  buttonLabel: string;
  busy: boolean;
  onGenerate: () => void;
  onEdit: (text: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  if (!value?.trim() && !editing) {
    return (
      <View style={{ gap: 8 }}>
        <Empty icon="sparkles-outline" title={emptyTitle} hint={emptyHint} />
        <Button icon="sparkles" title={buttonLabel} loading={busy} onPress={onGenerate} />
      </View>
    );
  }
  return (
    <View style={{ gap: 12 }}>
      <Row style={{ justifyContent: 'flex-end' }}>
        {editing ? (
          <Chip
            label="✓ Concluir"
            active
            onPress={() => {
              onEdit(draft);
              setEditing(false);
            }}
          />
        ) : (
          <>
            <Chip label="✏️ Editar" onPress={() => setEditing(true)} />
            <Chip label={busy ? 'Gerando…' : '↻ Gerar de novo'} onPress={busy ? undefined : onGenerate} />
          </>
        )}
      </Row>
      {editing ? <MarkdownEditor value={draft} onChange={setDraft} /> : <MarkdownView value={value ?? ''} />}
    </View>
  );
}
