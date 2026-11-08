import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, Chip, Empty, Input, Row, Sheet, T } from '../../components/ui';
import { confirm } from '../../lib/alert';
import { formatRelative } from '../../lib/dates';
import { alive, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import type { Note } from '../../lib/types';

const EMOJIS = ['📘', '📗', '📕', '📙', '🧪', '🧮', '🌍', '💻', '⚖️', '🩺', '🎨', '🎵'];

export default function NotesScreen() {
  const t = useTheme();
  const notesColl = useStore((s) => s.notes);
  const notebooksColl = useStore((s) => s.notebooks);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [menuNote, setMenuNote] = useState<Note | null>(null);
  const [moveNote, setMoveNote] = useState<Note | null>(null);
  const [nbSheet, setNbSheet] = useState(false);
  const [nbName, setNbName] = useState('');
  const [nbEmoji, setNbEmoji] = useState(EMOJIS[0]);

  const notebooks = useMemo(() => alive(notebooksColl).sort((a, b) => a.name.localeCompare(b.name)), [notebooksColl]);

  const notes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return alive(notesColl)
      .filter((n) => filter === 'all' || (filter === 'none' ? !n.notebookId : n.notebookId === filter))
      .filter(
        (n) =>
          !q ||
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q) ||
          n.tags.some((tag) => tag.toLowerCase().includes(q)),
      )
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || b.updatedAt - a.updatedAt);
  }, [notesColl, query, filter]);

  const create = () => {
    const n = useStore.getState().createNote({
      notebookId: filter !== 'all' && filter !== 'none' ? filter : null,
    });
    router.push({ pathname: '/note/[id]', params: { id: n.id } });
  };

  const saveNotebook = () => {
    if (!nbName.trim()) return;
    const nb = useStore.getState().upsertNotebook({ name: nbName.trim(), emoji: nbEmoji });
    setNbName('');
    setNbSheet(false);
    setFilter(nb.id);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T size={28} weight="800">
            Notas
          </T>
          <Button small icon="add" title="Nova" onPress={create} />
        </Row>
        <Input
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar em títulos, conteúdo e tags"
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          <Chip label="Todas" active={filter === 'all'} onPress={() => setFilter('all')} />
          {notebooks.map((nb) => (
            <Chip
              key={nb.id}
              label={`${nb.emoji} ${nb.name}`}
              active={filter === nb.id}
              onPress={() => setFilter(nb.id)}
              onLongPress={() => confirmDeleteNotebook(nb.id, nb.name, () => setFilter('all'))}
            />
          ))}
          <Chip label="Sem caderno" active={filter === 'none'} onPress={() => setFilter('none')} />
          <Chip label="+ Caderno" onPress={() => setNbSheet(true)} />
        </ScrollView>
      </View>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10, paddingBottom: 60 }}
        ListEmptyComponent={
          <Empty
            icon="document-text-outline"
            title={query ? 'Nada encontrado' : 'Nenhuma nota ainda'}
            hint={query ? 'Tente outra palavra.' : 'Toque em "Nova" para começar.'}
          />
        }
        renderItem={({ item: n }) => {
          const nb = n.notebookId ? notebooksColl[n.notebookId] : undefined;
          return (
            <Card style={{ padding: 0 }}>
              <Pressable
                onPress={() => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
                onLongPress={() => setMenuNote(n)}
                delayLongPress={300}
                style={({ pressed }) => ({ padding: 16, gap: 4, opacity: pressed ? 0.7 : 1 })}
              >
                <Row style={{ justifyContent: 'space-between' }}>
                  <T weight="700" numberOfLines={1} style={{ flex: 1 }}>
                    {n.pinned ? '📌 ' : ''}
                    {n.title || 'Sem título'}
                  </T>
                  <Pressable hitSlop={10} onPress={() => setMenuNote(n)} accessibilityLabel="Opções da nota">
                    <Ionicons name="ellipsis-horizontal" size={18} color={t.textMuted} />
                  </Pressable>
                </Row>
                <T muted size={13} numberOfLines={2}>
                  {(n.summary || n.content).replace(/[#*_>`]/g, '').trim() || 'Nota vazia'}
                </T>
                <Row style={{ marginTop: 6, flexWrap: 'wrap' }}>
                  {nb && !nb.deleted ? (
                    <T size={12} muted>
                      {nb.emoji} {nb.name} ·
                    </T>
                  ) : null}
                  <T size={12} muted>
                    {formatRelative(n.updatedAt)}
                  </T>
                  {n.summary ? <Ionicons name="sparkles" size={12} color={t.accent} /> : null}
                  {n.attachments.length ? <Ionicons name="image-outline" size={12} color={t.textMuted} /> : null}
                  {n.tags.slice(0, 3).map((tag) => (
                    <T key={tag} size={12} color={t.accent}>
                      #{tag}
                    </T>
                  ))}
                </Row>
              </Pressable>
            </Card>
          );
        }}
      />

      <Sheet
        visible={!!menuNote}
        onClose={() => setMenuNote(null)}
        title={menuNote?.title || 'Sem título'}
        options={
          menuNote
            ? [
                {
                  label: menuNote.pinned ? 'Desafixar' : 'Fixar no topo',
                  icon: 'pin-outline',
                  onPress: () => useStore.getState().updateNote(menuNote.id, { pinned: !menuNote.pinned }),
                },
                { label: 'Mover para caderno', icon: 'folder-outline', onPress: () => setMoveNote(menuNote) },
                {
                  label: 'Excluir nota',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () =>
                    confirm('Excluir nota?', 'Os flashcards desta nota também serão excluídos.', 'Excluir', () =>
                      useStore.getState().deleteNote(menuNote.id),
                    ),
                },
              ]
            : []
        }
      />

      <Sheet
        visible={!!moveNote}
        onClose={() => setMoveNote(null)}
        title="Mover para"
        options={[
          ...notebooks.map((nb) => ({
            label: `${nb.emoji} ${nb.name}`,
            onPress: () => moveNote && useStore.getState().updateNote(moveNote.id, { notebookId: nb.id }),
          })),
          {
            label: 'Sem caderno',
            icon: 'remove-circle-outline' as const,
            onPress: () => moveNote && useStore.getState().updateNote(moveNote.id, { notebookId: null }),
          },
        ]}
      />

      <Sheet visible={nbSheet} onClose={() => setNbSheet(false)} title="Novo caderno">
        <View style={{ gap: 12 }}>
          <Input value={nbName} onChangeText={setNbName} placeholder="Ex.: Anatomia, Cálculo I" autoFocus />
          <Row style={{ flexWrap: 'wrap' }}>
            {EMOJIS.map((e) => (
              <Pressable
                key={e}
                onPress={() => setNbEmoji(e)}
                style={{
                  padding: 8,
                  borderRadius: 10,
                  backgroundColor: nbEmoji === e ? t.accentSoft : 'transparent',
                }}
              >
                <T size={22}>{e}</T>
              </Pressable>
            ))}
          </Row>
          <Button title="Criar caderno" onPress={saveNotebook} disabled={!nbName.trim()} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

function confirmDeleteNotebook(id: string, name: string, after: () => void) {
  confirm(`Excluir o caderno "${name}"?`, 'As notas continuam salvas, só ficam sem caderno.', 'Excluir', () => {
    useStore.getState().deleteNotebook(id);
    after();
  });
}
