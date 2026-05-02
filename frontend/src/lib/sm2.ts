export interface SM2Result {
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReview: Date;
}

export interface SM2Input {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
}

export function sm2(quality: number, card: SM2Input): SM2Result {
  let { easeFactor: ef, intervalDays: interval, repetitions } = card;

  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1;
    } else if (repetitions === 1) {
      interval = 6;
    } else {
      interval = Math.round(interval * ef);
    }
    repetitions += 1;
  } else {
    repetitions = 0;
    interval = 1;
  }

  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  ef = Math.max(1.3, ef);

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + interval);

  return { easeFactor: ef, interval, repetitions, nextReview };
}

export const QUALITY_MAP = {
  again: 0,
  hard: 2,
  good: 4,
  easy: 5,
} as const;

export type QualityRating = keyof typeof QUALITY_MAP;
