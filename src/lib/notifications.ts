import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { startOfDay } from './srs';
import { alive, useStore } from './store';

/**
 * Notificações inteligentes (locais, funcionam offline):
 *  - aviso antes do prazo de cada tarefa (antecedência configurável);
 *  - lembrete diário de estudo SÓ nos dias em que há flashcards para revisar
 *    ou tarefas vencendo, com a contagem real daquele dia;
 *  - um aviso pela manhã quando há tarefas atrasadas.
 * Tudo é recalculado sempre que tarefas, cartões ou ajustes mudam.
 */

const CHANNEL = 'study';
const DAY = 24 * 60 * 60 * 1000;
/** O iOS permite no máximo 64 notificações agendadas por app. */
const MAX_SCHEDULED = 60;

let initialized = false;

export function initNotifications() {
  if (initialized || Platform.OS === 'web') return;
  initialized = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    void Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Estudos e tarefas',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

interface Planned {
  at: number;
  title: string;
  body: string;
  url: string;
}

function parseTime(hhmm: string): [number, number] {
  const [h, m] = hhmm.split(':').map(Number);
  return [Number.isFinite(h) ? h : 19, Number.isFinite(m) ? m : 0];
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Calcula as notificações dos próximos dias a partir dos dados atuais. */
export function planNotifications(now = Date.now()): Planned[] {
  const { settings, tasks, flashcards } = useStore.getState();
  const pending = alive(tasks).filter((t) => !t.done);
  const cards = alive(flashcards);
  const plan: Planned[] = [];

  // 1) Lembretes de tarefas com prazo
  const offset = settings.taskReminderOffsetMin * 60 * 1000;
  for (const t of pending) {
    if (!t.dueAt) continue;
    const at = t.dueAt - offset;
    if (at <= now) continue;
    plan.push({
      at,
      title: t.priority === 'high' ? `⚠️ ${t.title}` : t.title,
      body:
        settings.taskReminderOffsetMin > 0
          ? `Vence em ${settings.taskReminderOffsetMin} min.`
          : 'Vence agora.',
      url: '/tasks',
    });
  }

  // 2) Resumo diário de estudo (só nos dias com algo a fazer)
  const [h, m] = parseTime(settings.dailyReminderTime);
  for (let d = 0; d < 7; d++) {
    const day = startOfDay(now) + d * DAY;
    const at = new Date(day).setHours(h, m, 0, 0);
    if (at <= now) continue;
    const endOfDay = day + DAY;
    const due = cards.filter((c) => c.dueAt < endOfDay).length;
    const tasksToday = pending.filter((t) => t.dueAt && t.dueAt < endOfDay).length;
    if (!due && !tasksToday) continue;
    const parts = [];
    if (due) parts.push(plural(due, 'flashcard para revisar', 'flashcards para revisar'));
    if (tasksToday) parts.push(plural(tasksToday, 'tarefa pendente', 'tarefas pendentes'));
    plan.push({
      at,
      title: due ? 'Hora de revisar 📚' : 'Tarefas de hoje ✅',
      body: `Você tem ${parts.join(' e ')}.`,
      url: due ? '/review' : '/tasks',
    });
  }

  // 3) Tarefas atrasadas: avisa amanhã às 9h
  const overdue = pending.filter((t) => t.dueAt && t.dueAt < now).length;
  if (overdue) {
    plan.push({
      at: new Date(startOfDay(now) + DAY).setHours(9, 0, 0, 0),
      title: 'Tarefas atrasadas',
      body: `${plural(overdue, 'tarefa está', 'tarefas estão')} com o prazo vencido.`,
      url: '/tasks',
    });
  }

  return plan.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Reagenda tudo (com pequeno atraso para agrupar várias alterações seguidas). */
export function rescheduleSoon() {
  if (Platform.OS === 'web') return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void reschedule(), 1500);
}

export async function reschedule() {
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!useStore.getState().settings.notificationsEnabled) return;
  const perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) return;

  for (const p of planNotifications()) {
    await Notifications.scheduleNotificationAsync({
      content: { title: p.title, body: p.body, data: { url: p.url }, sound: 'default' },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: p.at,
        channelId: CHANNEL,
      },
    });
  }
}
