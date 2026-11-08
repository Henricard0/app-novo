import type { Task } from './types';

const DAY = 24 * 60 * 60 * 1000;

export function isOverdue(task: Task, now = Date.now()) {
  return !task.done && task.dueAt !== null && task.dueAt < now;
}

/** "Hoje, 14:30", "Amanhã, 09:00", "seg., 12 de mai., 10:00"... */
export function formatDue(ts: number, now = Date.now()): string {
  const d = new Date(ts);
  const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((ts - today.getTime()) / DAY);
  if (diffDays === 0) return `Hoje, ${time}`;
  if (diffDays === 1) return `Amanhã, ${time}`;
  if (diffDays === -1) return `Ontem, ${time}`;
  return `${d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}`;
}

export function formatRelative(ts: number, now = Date.now()): string {
  const min = Math.round((now - ts) / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  if (d < 30) return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
  return new Date(ts).toLocaleDateString('pt-BR');
}
