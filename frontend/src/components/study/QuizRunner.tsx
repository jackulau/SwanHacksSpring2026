import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle } from 'lucide-react';
import { useStudySession } from '../../hooks/useStudySession';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { QuizQuestion } from '../../lib/types';

interface QuizRunnerProps {
  questions: QuizQuestion[];
  onComplete: (answers: QuizAnswer[]) => void;
  lectureId?: string;
}

interface QuizAnswer {
  questionId: string;
  answer: number | boolean | string;
  correct: boolean;
  pointsEarned: number;
}

export function QuizRunner({ questions, onComplete, lectureId }: QuizRunnerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number | boolean | string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [results, setResults] = useState<QuizAnswer[]>([]);

  const question = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const hasAnswer = question ? answers[question.id] !== undefined : false;

  const { start, finish } = useStudySession();
  const sessionIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (questions.length === 0) return;
    if (sessionIdRef.current) return;

    let cancelled = false;
    start({ session_type: 'quiz', lecture: lectureId })
      .then((id) => {
        if (cancelled) return;
        sessionIdRef.current = id;
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [questions.length, lectureId, start]);

  useEffect(() => {
    return () => {
      const id = sessionIdRef.current;
      if (!id || finishedRef.current) return;
      finishedRef.current = true;
      void finish(id);
    };
  }, [finish]);

  const handleAnswer = useCallback(
    (value: number | boolean | string) => {
      if (!question) return;
      setAnswers((a) => ({ ...a, [question.id]: value }));
    },
    [question],
  );

  const handleSubmit = useCallback(() => {
    const quizAnswers: QuizAnswer[] = questions.map((q) => {
      const userAnswer = answers[q.id];
      let correct = false;

      if (q.type === 'multiple_choice') {
        correct = userAnswer === q.correct_answer;
      } else if (q.type === 'true_false') {
        correct = userAnswer === q.correct_answer;
      } else if (q.type === 'short_answer' || q.type === 'fill_blank') {
        const expected = String(q.correct_answer).toLowerCase().trim();
        const given = String(userAnswer || '').toLowerCase().trim();
        correct = given === expected;
        if (!correct && q.accept_also) {
          correct = q.accept_also.some(
            (alt: string) => alt.toLowerCase().trim() === given,
          );
        }
      }

      return {
        questionId: q.id,
        answer: userAnswer ?? '',
        correct,
        pointsEarned: correct ? q.points : 0,
      };
    });

    setResults(quizAnswers);
    setSubmitted(true);

    const sessionId = sessionIdRef.current;
    if (sessionId && !finishedRef.current) {
      finishedRef.current = true;
      const correctAnswers = quizAnswers.reduce(
        (count, a) => count + (a.correct ? 1 : 0),
        0,
      );
      void finish(sessionId, {
        cards_reviewed: questions.length,
        cards_correct: correctAnswers,
      });
    }

    onComplete(quizAnswers);
  }, [questions, answers, onComplete, finish]);

  // Keyboard: Enter submits when on last question and answered; otherwise advances.
  useKeyboardShortcuts([
    {
      key: 'Enter',
      handler: () => {
        if (submitted || !hasAnswer) return;
        if (isLast) {
          handleSubmit();
        } else {
          setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
        }
      },
    },
  ]);

  if (submitted) {
    const totalEarned = results.reduce((s, r) => s + r.pointsEarned, 0);
    const totalPossible = questions.reduce((s, q) => s + q.points, 0);
    const pct = totalPossible > 0 ? Math.round((totalEarned / totalPossible) * 100) : 0;

    // Group correctness by concept_tag for a per-concept breakdown.
    const conceptStats = questions.reduce<
      Record<string, { correct: number; total: number }>
    >((acc, q, idx) => {
      const tag = (q.concept_tag || '').trim() || 'Uncategorized';
      const bucket = acc[tag] ?? { correct: 0, total: 0 };
      const isCorrect = results[idx]?.correct ?? false;
      acc[tag] = {
        correct: bucket.correct + (isCorrect ? 1 : 0),
        total: bucket.total + 1,
      };
      return acc;
    }, {});
    const conceptRows = Object.entries(conceptStats).sort(([a], [b]) =>
      a.localeCompare(b),
    );

    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <p className="text-6xl font-semibold text-[var(--color-text)] tracking-tight tabular-nums">
            {pct}%
          </p>
          <p className="text-[var(--color-text-muted)] mt-2 tabular-nums">
            {totalEarned} of {totalPossible} points
          </p>
        </div>

        {conceptRows.length > 0 && (
          <section aria-label="Score by concept" className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
              By concept
            </h3>
            <dl className="divide-y divide-[var(--color-border)]">
              {conceptRows.map(([tag, { correct, total }]) => (
                <div
                  key={tag}
                  className="flex items-baseline justify-between gap-4 py-2 text-sm"
                >
                  <dt className="text-[var(--color-text)] truncate">{tag}</dt>
                  <dd className="shrink-0 tabular-nums text-[var(--color-text-muted)]">
                    <span
                      className={
                        correct === total
                          ? 'text-[var(--color-primary)] font-medium'
                          : ''
                      }
                    >
                      {correct}
                    </span>
                    {' / '}
                    {total}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <ul className="space-y-2">
          {questions.map((q, idx) => {
            const result = results[idx];
            return (
              <li
                key={q.id}
                className="flex items-start gap-3 p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-raised)]"
              >
                {result.correct ? (
                  <CheckCircle2
                    className="w-5 h-5 text-[var(--color-primary-strong)] mt-0.5 shrink-0"
                    aria-label="Correct"
                  />
                ) : (
                  <XCircle
                    className="w-5 h-5 text-[var(--color-record)] mt-0.5 shrink-0"
                    aria-label="Incorrect"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-[var(--color-text)]">{q.question}</p>
                  {q.explanation && (
                    <p className="text-[var(--color-text-muted)] text-sm mt-2">
                      {q.explanation}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <div className="flex justify-center pt-4">
          <button
            type="button"
            onClick={() => {
              setAnswers({});
              setResults([]);
              setSubmitted(false);
              setCurrentIdx(0);
              finishedRef.current = false;
              sessionIdRef.current = null;
            }}
            className="text-sm font-medium text-[var(--color-text)] border border-[var(--color-border-strong)] hover:bg-[var(--color-surface-raised)] rounded-md px-4 py-2 transition-colors"
          >
            Retake quiz
          </button>
        </div>
      </div>
    );
  }

  if (!question) return null;

  const progress = ((currentIdx + 1) / questions.length) * 100;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 220px)' }}>
      <div className="space-y-2">
        <div
          className="w-full h-1 bg-[var(--color-border)] rounded-md overflow-hidden"
          role="progressbar"
          aria-valuenow={currentIdx + 1}
          aria-valuemin={1}
          aria-valuemax={questions.length}
        >
          <div
            className="h-full bg-[var(--color-primary)] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-xs text-[var(--color-text-subtle)] tabular-nums">
          <span>
            Question {currentIdx + 1} of {questions.length}
          </span>
          <span className="capitalize">{question.difficulty}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center py-12 max-w-2xl mx-auto w-full">
        <h2 className="text-2xl sm:text-3xl text-[var(--color-text)] font-medium tracking-tight leading-snug mb-8">
          {question.question}
        </h2>

        {question.type === 'multiple_choice' && (
          <fieldset
            role="radiogroup"
            aria-label="Answer choices"
            className="space-y-2 border-0 p-0 m-0"
          >
            {question.options.map((opt, idx) => {
              const selected = answers[question.id] === idx;
              return (
                <label
                  key={idx}
                  className={`flex items-center gap-3 p-4 rounded-md border cursor-pointer transition-colors ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface-raised)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={selected}
                    onChange={() => handleAnswer(idx)}
                    className="sr-only"
                  />
                  <span
                    aria-hidden="true"
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                      selected
                        ? 'border-[var(--color-primary)]'
                        : 'border-[var(--color-border-strong)]'
                    }`}
                  >
                    {selected && (
                      <span className="w-2 h-2 rounded-full bg-[var(--color-primary)]" />
                    )}
                  </span>
                  <span className="text-[var(--color-text)] text-base">{opt}</span>
                </label>
              );
            })}
          </fieldset>
        )}

        {question.type === 'true_false' && (
          <fieldset
            role="radiogroup"
            aria-label="True or false"
            className="grid grid-cols-2 gap-2 border-0 p-0 m-0"
          >
            {[true, false].map((val) => {
              const selected = answers[question.id] === val;
              return (
                <label
                  key={String(val)}
                  className={`flex items-center justify-center p-6 rounded-md border cursor-pointer transition-colors text-lg font-medium ${
                    selected
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-text)]'
                      : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] text-[var(--color-text-muted)]'
                  }`}
                >
                  <input
                    type="radio"
                    name={question.id}
                    checked={selected}
                    onChange={() => handleAnswer(val)}
                    className="sr-only"
                  />
                  {val ? 'True' : 'False'}
                </label>
              );
            })}
          </fieldset>
        )}

        {(question.type === 'short_answer' || question.type === 'fill_blank') && (
          <input
            type="text"
            value={String(answers[question.id] ?? '')}
            onChange={(e) => handleAnswer(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || submitted || !hasAnswer) return;
              e.preventDefault();
              if (isLast) handleSubmit();
              else setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
            }}
            placeholder={
              question.type === 'fill_blank' ? 'Fill in the blank…' : 'Type your answer…'
            }
            autoFocus
            className="w-full bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-md px-4 h-12 text-lg text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
            aria-label="Your answer"
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="h-10 px-3 rounded-md text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={!hasAnswer}
            className="h-10 px-6 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Submit
            <span className="ml-2 text-[11px] opacity-70">Enter</span>
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            disabled={!hasAnswer}
            className="h-10 px-4 rounded-md text-sm text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
