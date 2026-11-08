import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MarkdownView } from '../components/MarkdownView';
import { Button, Empty, Row, T } from '../components/ui';
import { isDue, previewInterval, review, type Grade } from '../lib/srs';
import { alive, useStore } from '../lib/store';
import { useTheme } from '../lib/theme';

const GRADES: { grade: Grade; label: string; color: 'danger' | 'warning' | 'accent' | 'success' }[] = [
  { grade: 'again', label: 'Errei', color: 'danger' },
  { grade: 'hard', label: 'Difícil', color: 'warning' },
  { grade: 'good', label: 'Bom', color: 'accent' },
  { grade: 'easy', label: 'Fácil', color: 'success' },
];

/** Sessão de revisão com repetição espaçada. Funciona totalmente offline. */
export default function ReviewScreen() {
  const { noteId, all } = useLocalSearchParams<{ noteId?: string; all?: string }>();
  const t = useTheme();

  // A fila é montada uma vez no início da sessão.
  const [queue, setQueue] = useState<string[]>(() => {
    const cards = alive(useStore.getState().flashcards)
      .filter((c) => !noteId || c.noteId === noteId)
      .filter((c) => all === '1' || isDue(c))
      .sort((a, b) => a.dueAt - b.dueAt);
    return cards.map((c) => c.id);
  });
  const [total] = useState(queue.length);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ right: 0, wrong: 0 });

  const card = useStore((s) => (queue[0] ? s.flashcards[queue[0]] : undefined));
  const notes = useStore((s) => s.notes);
  const source = card?.noteId ? notes[card.noteId] : undefined;
  const done = total - new Set(queue).size;

  const options = useMemo(
    () => (card ? GRADES.map((g) => ({ ...g, next: previewInterval(card, g.grade) })) : []),
    [card],
  );

  const answer = (grade: Grade) => {
    if (!card) return;
    if (Platform.OS !== 'web') void Haptics.selectionAsync();
    useStore.getState().updateFlashcard(card.id, review(card, grade));
    setStats((s) => (grade === 'again' ? { ...s, wrong: s.wrong + 1 } : { ...s, right: s.right + 1 }));
    // Cartões errados voltam para o fim da fila desta sessão.
    setQueue((q) => (grade === 'again' ? [...q.slice(1), q[0]] : q.slice(1)));
    setRevealed(false);
  };

  if (!total) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 20, justifyContent: 'center' }}>
        <Empty icon="checkmark-done-circle-outline" title="Tudo revisado!" hint="Não há cartões para revisar agora. Volte mais tarde." />
        <Button title="Voltar" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  if (!card) {
    const pct = Math.round((stats.right / Math.max(1, stats.right + stats.wrong)) * 100);
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: t.bg, padding: 20, justifyContent: 'center', gap: 16 }}>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <Ionicons name="trophy-outline" size={56} color={t.accent} />
          <T size={24} weight="800">
            Sessão concluída
          </T>
          <T muted center>
            {total} {total === 1 ? 'cartão revisado' : 'cartões revisados'} · {pct}% de acertos
          </T>
        </View>
        <Button title="Concluir" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: t.bg }}>
      <View style={{ height: 4, backgroundColor: t.surfaceAlt }}>
        <View style={{ height: 4, width: `${(done / total) * 100}%`, backgroundColor: t.accent }} />
      </View>
      <Row style={{ justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12 }}>
        <T size={13} muted numberOfLines={1} style={{ flex: 1 }}>
          {source ? `📄 ${source.title || 'Sem título'}` : ''}
        </T>
        <T size={13} muted>
          {done + 1} / {total}
        </T>
      </Row>

      <Pressable style={{ flex: 1 }} onPress={() => setRevealed(true)} disabled={revealed}>
        <ScrollView contentContainerStyle={{ padding: 24, gap: 24, flexGrow: 1, justifyContent: 'center' }}>
          <View
            style={{
              backgroundColor: t.surface,
              borderRadius: 20,
              padding: 24,
              gap: 16,
              borderWidth: 1,
              borderColor: t.border,
              minHeight: 220,
              justifyContent: 'center',
            }}
          >
            <MarkdownView value={card.front} />
            {revealed ? (
              <>
                <View style={{ height: 1, backgroundColor: t.border }} />
                <MarkdownView value={card.back} />
              </>
            ) : null}
          </View>
          {!revealed ? (
            <T muted center size={13}>
              Pense na resposta e toque para ver
            </T>
          ) : null}
        </ScrollView>
      </Pressable>

      <View style={{ padding: 16 }}>
        {revealed ? (
          <Row style={{ gap: 8 }}>
            {options.map((o) => (
              <Pressable
                key={o.grade}
                onPress={() => answer(o.grade)}
                style={({ pressed }) => ({
                  flex: 1,
                  alignItems: 'center',
                  paddingVertical: 12,
                  borderRadius: 14,
                  backgroundColor: t[o.color],
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                <T color="#fff" weight="700" size={14}>
                  {o.label}
                </T>
                <T color="#fff" size={11} style={{ opacity: 0.9 }}>
                  {o.next}
                </T>
              </Pressable>
            ))}
          </Row>
        ) : (
          <Button title="Mostrar resposta" onPress={() => setRevealed(true)} />
        )}
      </View>
    </SafeAreaView>
  );
}
