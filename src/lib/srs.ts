import type { Flashcard } from './types';

const DAY = 24 * 60 * 60 * 1000;

/** Notas de revisão exibidas na sessão de flashcards. */
export type Grade = 'again' | 'hard' | 'good' | 'easy';

const QUALITY: Record<Grade, number> = { again: 1, hard: 3, good: 4, easy: 5 };

/**
 * Algoritmo SM-2 (o mesmo princípio do Anki): cartões que você acerta
 * aparecem em intervalos cada vez maiores; os que você erra voltam logo.
 */
export function review(card: Flashcard, grade: Grade, now = Date.now()): Flashcard {
  const q = QUALITY[grade];
  let { ease, interval, repetitions } = card;

  if (q < 3) {
    repetitions = 0;
    interval = 0; // volta ainda hoje (10 min)
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = grade === 'easy' ? 3 : 1;
    else if (repetitions === 2) interval = grade === 'easy' ? 7 : 4;
    else interval = Math.round(interval * ease * (grade === 'hard' ? 0.8 : grade === 'easy' ? 1.3 : 1));
  }
  ease = Math.max(1.3, ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  const dueAt = interval === 0 ? now + 10 * 60 * 1000 : startOfDay(now) + interval * DAY;
  return { ...card, ease, interval, repetitions, dueAt, lastReviewedAt: now, updatedAt: now };
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return !card.deleted && card.dueAt <= now;
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Texto curto para o próximo intervalo, mostrado nos botões de revisão. */
export function previewInterval(card: Flashcard, grade: Grade): string {
  const next = review(card, grade);
  if (next.interval === 0) return '10 min';
  if (next.interval === 1) return '1 dia';
  if (next.interval < 30) return `${next.interval} dias`;
  const months = Math.round(next.interval / 30);
  return months === 1 ? '1 mês' : `${months} meses`;
}
