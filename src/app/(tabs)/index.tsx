import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, Row, Screen, SectionTitle, T, type IconName } from '../../components/ui';
import { isDue } from '../../lib/srs';
import { alive, useStore } from '../../lib/store';
import { cloudConfigured } from '../../lib/supabase';
import { useTheme } from '../../lib/theme';
import { formatDue, isOverdue } from '../../lib/dates';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Painel minimalista: só o que importa para a sessão de estudo de hoje. */
export default function Dashboard() {
  const t = useTheme();
  const notesColl = useStore((s) => s.notes);
  const cardsColl = useStore((s) => s.flashcards);
  const tasksColl = useStore((s) => s.tasks);
  const settings = useStore((s) => s.settings);
  const pendingSync = useStore((s) => Object.keys(s.dirty).length);
  const aiQueue = useStore((s) => s.aiQueue.length);
  const createNote = useStore((s) => s.createNote);
  const w = settings.widgets;

  const { notes, due, pending, upcoming } = useMemo(() => {
    const notes = alive(notesColl).sort((a, b) => b.updatedAt - a.updatedAt);
    const due = alive(cardsColl).filter((c) => isDue(c)).length;
    const pending = alive(tasksColl).filter((x) => !x.done);
    const upcoming = [...pending]
      .sort((a, b) => (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity))
      .slice(0, 4);
    return { notes, due, pending, upcoming };
  }, [notesColl, cardsColl, tasksColl]);

  const newNote = (mode?: 'dictate' | 'photo') => {
    const n = createNote();
    router.push({ pathname: '/note/[id]', params: { id: n.id, ...(mode ? { start: mode } : {}) } });
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <T size={28} weight="800">
            {greeting()}
            {settings.userName ? `, ${settings.userName}` : ''}
          </T>
          <T muted>
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </T>
        </View>
        {cloudConfigured ? (
          <Pressable onPress={() => router.push('/auth')} accessibilityLabel="Estado da sincronização">
            <Ionicons
              name={pendingSync ? 'cloud-upload-outline' : 'cloud-done-outline'}
              size={24}
              color={pendingSync ? t.warning : t.success}
            />
          </Pressable>
        ) : null}
      </Row>

      {w.stats ? (
        <Row style={{ gap: 12 }}>
          <Stat label="Notas" value={notes.length} icon="document-text-outline" />
          <Stat label="Para revisar" value={due} icon="albums-outline" highlight={due > 0} />
          <Stat label="Tarefas" value={pending.length} icon="checkmark-circle-outline" />
        </Row>
      ) : null}

      {w.review && due > 0 ? (
        <Card style={{ backgroundColor: t.accent, borderColor: t.accent }} onPress={() => router.push('/review')}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flex: 1, gap: 2 }}>
              <T color={t.onAccent} size={17} weight="700">
                {due} {due === 1 ? 'cartão espera' : 'cartões esperam'} por você
              </T>
              <T color={t.onAccent} size={13} style={{ opacity: 0.85 }}>
                Uma revisão rápida agora fixa o conteúdo por muito mais tempo.
              </T>
            </View>
            <Ionicons name="play-circle" size={40} color={t.onAccent} />
          </Row>
        </Card>
      ) : null}

      {w.quickActions ? (
        <Row style={{ gap: 10 }}>
          <Quick icon="create-outline" label="Nova nota" onPress={() => newNote()} />
          <Quick icon="mic-outline" label="Ditar" onPress={() => newNote('dictate')} />
          <Quick icon="camera-outline" label="Foto" onPress={() => newNote('photo')} />
        </Row>
      ) : null}

      {aiQueue > 0 ? (
        <Card>
          <Row>
            <Ionicons name="time-outline" size={18} color={t.warning} />
            <T size={13} muted style={{ flex: 1 }}>
              {aiQueue} {aiQueue === 1 ? 'pedido de IA aguarda' : 'pedidos de IA aguardam'} a conexão voltar.
            </T>
          </Row>
        </Card>
      ) : null}

      {w.tasks ? (
        <>
          <SectionTitle
            title="Próximas tarefas"
            action={<Button small variant="ghost" title="Ver todas" onPress={() => router.push('/tasks')} />}
          />
          {upcoming.length ? (
            <Card style={{ paddingVertical: 4 }}>
              {upcoming.map((task, i) => (
                <Pressable
                  key={task.id}
                  onPress={() => useStore.getState().toggleTask(task.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 12,
                    paddingVertical: 12,
                    borderTopWidth: i ? 1 : 0,
                    borderTopColor: t.border,
                  }}
                >
                  <Ionicons name="ellipse-outline" size={22} color={t.textMuted} />
                  <View style={{ flex: 1 }}>
                    <T numberOfLines={1}>{task.title}</T>
                    {task.dueAt ? (
                      <T size={12} color={isOverdue(task) ? t.danger : t.textMuted}>
                        {formatDue(task.dueAt)}
                      </T>
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </Card>
          ) : (
            <T muted size={13}>
              Nada pendente. 🎉
            </T>
          )}
        </>
      ) : null}

      {w.recent ? (
        <>
          <SectionTitle
            title="Notas recentes"
            action={<Button small variant="ghost" title="Ver todas" onPress={() => router.push('/notes')} />}
          />
          {notes.slice(0, 5).map((n) => (
            <Card
              key={n.id}
              onPress={() => router.push({ pathname: '/note/[id]', params: { id: n.id } })}
              style={{ paddingVertical: 12 }}
            >
              <T weight="600" numberOfLines={1}>
                {n.title || 'Sem título'}
              </T>
              <T muted size={13} numberOfLines={2}>
                {(n.summary || n.content).replace(/[#*_>`-]/g, '').trim() || 'Nota vazia'}
              </T>
            </Card>
          ))}
          {!notes.length ? (
            <T muted size={13}>
              Comece criando sua primeira nota, ditando ou tirando uma foto do caderno.
            </T>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: number; icon: IconName; highlight?: boolean }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, padding: 12, gap: 4 }}>
      <Ionicons name={icon} size={18} color={highlight ? t.accent : t.textMuted} />
      <T size={22} weight="800" color={highlight ? t.accent : undefined}>
        {value}
      </T>
      <T size={12} muted numberOfLines={1}>
        {label}
      </T>
    </Card>
  );
}

function Quick({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 16,
        backgroundColor: t.accentSoft,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={t.accent} />
      <T size={13} weight="600" color={t.accent}>
        {label}
      </T>
    </Pressable>
  );
}
