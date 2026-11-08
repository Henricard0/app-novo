import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Empty, IconButton, Input, Row, Screen, SectionTitle, Sheet, T } from '../../components/ui';
import { errorMessage, notify } from '../../lib/alert';
import { exportFlashcards, type CardsFormat } from '../../lib/export';
import { isDue } from '../../lib/srs';
import { alive, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';

interface Deck {
  noteId: string | null;
  title: string;
  total: number;
  due: number;
  mastered: number;
}

export default function FlashcardsScreen() {
  const t = useTheme();
  const cardsColl = useStore((s) => s.flashcards);
  const notesColl = useStore((s) => s.notes);
  const [exportSheet, setExportSheet] = useState(false);
  const [newCard, setNewCard] = useState<{ front: string; back: string } | null>(null);

  const { decks, due, total } = useMemo(() => {
    const cards = alive(cardsColl);
    const map = new Map<string, Deck>();
    for (const c of cards) {
      const k = c.noteId ?? '__none';
      const note = c.noteId ? notesColl[c.noteId] : undefined;
      const d = map.get(k) ?? {
        noteId: c.noteId,
        title: note && !note.deleted ? note.title || 'Sem título' : 'Cartões avulsos',
        total: 0,
        due: 0,
        mastered: 0,
      };
      d.total++;
      if (isDue(c)) d.due++;
      if (c.interval >= 21) d.mastered++;
      map.set(k, d);
    }
    return {
      decks: [...map.values()].sort((a, b) => b.due - a.due || a.title.localeCompare(b.title)),
      due: cards.filter((c) => isDue(c)).length,
      total: cards.length,
    };
  }, [cardsColl, notesColl]);

  const doExport = async (format: CardsFormat) => {
    try {
      await exportFlashcards(format);
    } catch (e) {
      notify('Exportar', errorMessage(e));
    }
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <T size={28} weight="800">
          Flashcards
        </T>
        <Row style={{ gap: 4 }}>
          <IconButton icon="share-outline" label="Exportar flashcards" color={t.accent} onPress={() => setExportSheet(true)} />
          <Button small icon="add" title="Novo" onPress={() => setNewCard({ front: '', back: '' })} />
        </Row>
      </Row>

      <Card style={{ gap: 12 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <T size={32} weight="800" color={due ? t.accent : undefined}>
              {due}
            </T>
            <T muted size={13}>
              para revisar hoje · {total} no total
            </T>
          </View>
          <Ionicons name="albums" size={40} color={t.accentSoft} />
        </Row>
        <Button
          icon="play"
          title={due ? 'Começar revisão' : 'Nada para revisar agora'}
          disabled={!due}
          onPress={() => router.push('/review')}
        />
      </Card>

      <SectionTitle title="Baralhos" />
      {!decks.length ? (
        <Empty
          icon="albums-outline"
          title="Nenhum flashcard ainda"
          hint="Abra uma nota e toque em ✨ → Gerar flashcards. A IA cria perguntas e respostas a partir do seu conteúdo."
        />
      ) : null}
      {decks.map((d) => (
        <Card
          key={d.noteId ?? 'none'}
          onPress={() =>
            d.noteId
              ? router.push({ pathname: '/note/[id]', params: { id: d.noteId } })
              : router.push({ pathname: '/review', params: { all: '1' } })
          }
          style={{ gap: 8 }}
        >
          <Row style={{ justifyContent: 'space-between' }}>
            <T weight="700" numberOfLines={1} style={{ flex: 1 }}>
              {d.title}
            </T>
            {d.due ? (
              <View style={{ backgroundColor: t.accent, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <T size={12} weight="700" color={t.onAccent}>
                  {d.due}
                </T>
              </View>
            ) : null}
          </Row>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surfaceAlt, overflow: 'hidden' }}>
            <View style={{ height: 6, width: `${(d.mastered / d.total) * 100}%`, backgroundColor: t.success }} />
          </View>
          <T size={12} muted>
            {d.total} {d.total === 1 ? 'cartão' : 'cartões'} · {d.mastered} dominados
          </T>
        </Card>
      ))}

      <Sheet
        visible={exportSheet}
        onClose={() => setExportSheet(false)}
        title="Exportar todos os flashcards"
        options={[
          { label: 'CSV', icon: 'grid-outline', hint: 'Anki, Quizlet, Excel, Google Planilhas', onPress: () => void doExport('csv') },
          { label: 'TSV (separado por tabulação)', icon: 'grid-outline', hint: 'Importação direta no Anki', onPress: () => void doExport('tsv') },
          { label: 'JSON', icon: 'code-slash-outline', hint: 'Inclui o progresso de revisão', onPress: () => void doExport('json') },
        ]}
      />

      <Sheet visible={!!newCard} onClose={() => setNewCard(null)} title="Novo flashcard avulso">
        {newCard ? (
          <View style={{ gap: 12 }}>
            <Input label="Frente (pergunta)" multiline value={newCard.front} onChangeText={(front) => setNewCard({ ...newCard, front })} />
            <Input label="Verso (resposta)" multiline value={newCard.back} onChangeText={(back) => setNewCard({ ...newCard, back })} />
            <Button
              title="Adicionar"
              disabled={!newCard.front.trim() || !newCard.back.trim()}
              onPress={() => {
                useStore.getState().addFlashcards([newCard], null);
                setNewCard(null);
              }}
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
