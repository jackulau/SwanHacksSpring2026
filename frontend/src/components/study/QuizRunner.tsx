import { useState, useCallback, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';
import { useStudySession } from '../../hooks/useStudySession';
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

  const { start, finish } = useStudySession();
  const sessionIdRef = useRef<string | null>(null);
  const finishedRef = useRef(false);

  // Start a quiz session on mount (once questions are available).
  useEffect(() => {
    if (questions.length === 0) return;
    if (sessionIdRef.current) return;

    let cancelled = false;
    start({ session_type: 'quiz', lecture: lectureId })
      .then((id) => {
        if (cancelled) return;
        sessionIdRef.current = id;
      })
      .catch(() => {
        // Errors are already logged in the hook.
      });

    return () => {
      cancelled = true;
    };
  }, [questions.length, lectureId, start]);

  // Finish the session on unmount if it wasn't submitted.
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
      setAnswers((a) => ({ ...a, [question.id]: value }));
    },
    [question?.id],
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
        (count, answer) => count + (answer.correct ? 1 : 0),
        0,
      );
      void finish(sessionId, {
        cards_reviewed: questions.length,
        cards_correct: correctAnswers,
      });
    }

    onComplete(quizAnswers);
  }, [questions, answers, onComplete, finish]);

  if (submitted) {
    const totalEarned = results.reduce((s, r) => s + r.pointsEarned, 0);
    const totalPossible = questions.reduce((s, q) => s + q.points, 0);
    const pct = Math.round((totalEarned / totalPossible) * 100);

    return (
      <div className="space-y-6">
        <div className="text-center py-8">
          <p className="text-4xl font-bold text-zinc-100 mb-2">{pct}%</p>
          <p className="text-zinc-400">
            {totalEarned}/{totalPossible} points
          </p>
        </div>

        <div className="space-y-4">
          {questions.map((q, idx) => {
            const result = results[idx];
            return (
              <div
                key={q.id}
                className={`border rounded-lg p-4 ${
                  result.correct
                    ? 'border-green-700 bg-green-900/20'
                    : 'border-red-700 bg-red-900/20'
                }`}
              >
                <div className="flex items-start gap-2">
                  {result.correct ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-zinc-100 font-medium">{q.question}</p>
                    {q.explanation && (
                      <p className="text-zinc-400 text-sm mt-2">{q.explanation}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>
          Question {currentIdx + 1} of {questions.length}
        </span>
        <span className="capitalize">{question.difficulty}</span>
      </div>

      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
        <p className="text-lg text-zinc-100 mb-6">{question.question}</p>

        {question.type === 'multiple_choice' && (
          <div className="space-y-3">
            {question.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => handleAnswer(idx)}
                className={`w-full text-left p-4 rounded-lg border transition-colors ${
                  answers[question.id] === idx
                    ? 'border-indigo-500 bg-indigo-500/20 text-zinc-100'
                    : 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {question.type === 'true_false' && (
          <div className="flex gap-4">
            {[true, false].map((val) => (
              <button
                key={String(val)}
                onClick={() => handleAnswer(val)}
                className={`flex-1 p-4 rounded-lg border transition-colors font-medium ${
                  answers[question.id] === val
                    ? 'border-indigo-500 bg-indigo-500/20 text-zinc-100'
                    : 'border-zinc-700 hover:border-zinc-500 text-zinc-300'
                }`}
              >
                {val ? 'True' : 'False'}
              </button>
            ))}
          </div>
        )}

        {(question.type === 'short_answer' || question.type === 'fill_blank') && (
          <input
            type="text"
            value={String(answers[question.id] ?? '')}
            onChange={(e) => handleAnswer(e.target.value)}
            placeholder={
              question.type === 'fill_blank' ? 'Fill in the blank...' : 'Type your answer...'
            }
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-indigo-500"
          />
        )}
      </div>

      <div className="flex justify-between">
        <button
          onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
          disabled={currentIdx === 0}
          className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> Previous
        </button>

        {currentIdx === questions.length - 1 ? (
          <button
            onClick={handleSubmit}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Submit Quiz
          </button>
        ) : (
          <button
            onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
            className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
