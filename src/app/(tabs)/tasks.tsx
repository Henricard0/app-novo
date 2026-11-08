import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Button, Card, Chip, Empty, Input, Row, Screen, SectionTitle, Sheet, T } from '../../components/ui';
import { confirm, notify } from '../../lib/alert';
import { formatDue, isOverdue } from '../../lib/dates';
import { ensurePermission } from '../../lib/notifications';
import { alive, useStore } from '../../lib/store';
import { useTheme } from '../../lib/theme';
import type { Task } from '../../lib/types';

const HOUR = 60 * 60 * 1000;

/** Atalhos de prazo, para não depender de um seletor de data nativo. */
function quickDates(): { label: string; at: number }[] {
  const now = new Date();
  const at = (days: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  const tonight = at(0, 20);
  return [
    { label: 'Em 1 hora', at: Date.now() + HOUR },
    ...(tonight > Date.now() + HOUR ? [{ label: 'Hoje 20h', at: tonight }] : []),
    { label: 'Amanhã 9h', at: at(1, 9) },
    { label: 'Amanhã 19h', at: at(1, 19) },
    { label: 'Em 3 dias', at: at(3, 9) },
    { label: 'Próx. semana', at: at(7, 9) },
  ];
}

type Draft = Partial<Task> & { title: string };

export default function TasksScreen() {
  const t = useTheme();
  const tasksColl = useStore((s) => s.tasks);
  const notesColl = useStore((s) => s.notes);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showDone, setShowDone] = useState(false);

  const { overdue, upcoming, someday, done } = useMemo(() => {
    const all = alive(tasksColl);
    const open = all.filter((x) => !x.done);
    const byDue = (a: Task, b: Task) => (a.dueAt ?? 0) - (b.dueAt ?? 0);
    return {
      overdue: open.filter((x) => isOverdue(x)).sort(byDue),
      upcoming: open.filter((x) => x.dueAt && !isOverdue(x)).sort(byDue),
      someday: open.filter((x) => !x.dueAt).sort((a, b) => b.createdAt - a.createdAt),
      done: all.filter((x) => x.done).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30),
    };
  }, [tasksColl]);

  const save = async () => {
    if (!draft?.title.trim()) return;
    useStore.getState().upsertTask({ ...draft, title: draft.title.trim() });
    if (draft.dueAt && Platform.OS !== 'web' && useStore.getState().settings.notificationsEnabled) {
      const ok = await ensurePermission();
      if (!ok) notify('Lembretes desativados', 'Ative as notificações do app nos Ajustes do aparelho para receber lembretes.');
    }
    setDraft(null);
  };

  const renderTask = (task: Task) => {
    const note = task.noteId ? notesColl[task.noteId] : undefined;
    return (
      <Card key={task.id} style={{ paddingVertical: 12 }}>
        <Row style={{ gap: 12 }}>
          <Pressable onPress={() => useStore.getState().toggleTask(task.id)} hitSlop={8} accessibilityLabel="Concluir tarefa">
            <Ionicons
              name={task.done ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={task.done ? t.success : task.priority === 'high' ? t.danger : t.textMuted}
            />
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => setDraft(task)}>
            <T style={{ textDecorationLine: task.done ? 'line-through' : 'none' }} muted={task.done}>
              {task.title}
            </T>
            <Row style={{ flexWrap: 'wrap', gap: 6 }}>
              {task.dueAt ? (
                <T size={12} color={isOverdue(task) ? t.danger : t.textMuted}>
                  ⏰ {formatDue(task.dueAt)}
                </T>
              ) : null}
              {note && !note.deleted ? (
                <T size={12} color={t.accent} numberOfLines={1}>
                  📄 {note.title || 'Nota'}
                </T>
              ) : null}
            </Row>
          </Pressable>
        </Row>
      </Card>
    );
  };

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between', marginTop: 8 }}>
        <T size={28} weight="800">
          Tarefas
        </T>
        <Button small icon="add" title="Nova" onPress={() => setDraft({ title: '', priority: 'normal', dueAt: null })} />
      </Row>

      {!overdue.length && !upcoming.length && !someday.length ? (
        <Empty icon="checkmark-done-outline" title="Tudo em dia" hint="Crie tarefas com prazo para receber lembretes." />
      ) : null}

      {overdue.length ? (
        <>
          <SectionTitle title="Atrasadas" />
          {overdue.map(renderTask)}
        </>
      ) : null}
      {upcoming.length ? (
        <>
          <SectionTitle title="Com prazo" />
          {upcoming.map(renderTask)}
        </>
      ) : null}
      {someday.length ? (
        <>
          <SectionTitle title="Sem prazo" />
          {someday.map(renderTask)}
        </>
      ) : null}

      {done.length ? (
        <>
          <SectionTitle
            title={`Concluídas (${done.length})`}
            action={<Button small variant="ghost" title={showDone ? 'Ocultar' : 'Mostrar'} onPress={() => setShowDone((v) => !v)} />}
          />
          {showDone ? done.map(renderTask) : null}
        </>
      ) : null}

      <Sheet visible={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Editar tarefa' : 'Nova tarefa'}>
        {draft ? (
          <View style={{ gap: 14 }}>
            <Input
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
              placeholder="Ex.: Revisar capítulo 3"
              autoFocus={!draft.id}
            />
            <Input
              value={draft.details ?? ''}
              onChangeText={(details) => setDraft({ ...draft, details })}
              placeholder="Detalhes (opcional)"
              multiline
            />
            <T size={13} weight="600" muted>
              Prazo {draft.dueAt ? `· ${formatDue(draft.dueAt)}` : ''}
            </T>
            <Row style={{ flexWrap: 'wrap' }}>
              <Chip label="Sem prazo" active={!draft.dueAt} onPress={() => setDraft({ ...draft, dueAt: null })} />
              {quickDates().map((q) => (
                <Chip key={q.label} label={q.label} active={draft.dueAt === q.at} onPress={() => setDraft({ ...draft, dueAt: q.at })} />
              ))}
            </Row>
            <T size={13} weight="600" muted>
              Prioridade
            </T>
            <Row>
              {(
                [
                  ['low', 'Baixa'],
                  ['normal', 'Normal'],
                  ['high', 'Alta'],
                ] as const
              ).map(([p, label]) => (
                <Chip key={p} label={label} active={draft.priority === p} onPress={() => setDraft({ ...draft, priority: p })} />
              ))}
            </Row>
            <Button title="Salvar" disabled={!draft.title.trim()} onPress={() => void save()} />
            {draft.noteId ? (
              <Button
                variant="soft"
                icon="document-text-outline"
                title="Abrir nota"
                onPress={() => {
                  const id = draft.noteId!;
                  setDraft(null);
                  router.push({ pathname: '/note/[id]', params: { id } });
                }}
              />
            ) : null}
            {draft.id ? (
              <Button
                variant="ghost"
                title="Excluir tarefa"
                onPress={() =>
                  confirm('Excluir tarefa?', draft.title, 'Excluir', () => {
                    useStore.getState().deleteTask(draft.id!);
                    setDraft(null);
                  })
                }
              />
            ) : null}
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}
