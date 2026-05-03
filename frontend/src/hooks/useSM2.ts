import { useCallback } from 'react';
import { sm2, QUALITY_MAP, type QualityRating } from '../lib/sm2';
import { pb } from '../lib/pocketbase';
import type { Flashcard } from '../lib/types';

export function useSM2() {
  const rateCard = useCallback(async (card: Flashcard, rating: QualityRating) => {
    const quality = QUALITY_MAP[rating];
    const result = sm2(quality, {
      easeFactor: card.ease_factor,
      intervalDays: card.interval_days,
      repetitions: card.repetitions,
    });

    await pb.collection('flashcards').update(card.id, {
      ease_factor: result.easeFactor,
      interval_days: result.interval,
      repetitions: result.repetitions,
      next_review: result.nextReview.toISOString(),
      last_review: new Date().toISOString(),
    });

    return result;
  }, []);

  const getDueCards = useCallback(async (userId: string, lectureId?: string) => {
    const now = new Date().toISOString();
    const filter = lectureId
      ? `user = "${userId}" && (next_review <= "${now}" || next_review = "") && lecture = "${lectureId}"`
      : `user = "${userId}" && (next_review <= "${now}" || next_review = "")`;

    return pb.collection('flashcards').getFullList<Flashcard>({
      filter,
      sort: '-repetitions,ease_factor',
    });
  }, []);

  return { rateCard, getDueCards };
}
