import { createFileRoute } from "@tanstack/react-router";
import { PomodoroTimer } from "../components/study/PomodoroTimer";
import { StudyStreak } from "../components/study/StudyStreak";
import { usePreferences } from "../lib/preferences";
import { Clock, Flame, Target, BookOpen } from "lucide-react";

export const Route = createFileRoute("/study/planner")({
  component: StudyPlannerPage,
});

function StudyPlannerPage() {
  const { prefs } = usePreferences();

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Study Planner</h1>
        <p className="text-zinc-500 text-sm mt-1">Stay focused and track your sessions</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <StudyStreak streak={0} todayCompleted={false} />
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-zinc-400">Today&apos;s Goal</span>
          </div>
          <p className="text-2xl font-bold">0 / 4</p>
          <p className="text-xs text-zinc-500 mt-1">Pomodoro sessions</p>
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <PomodoroTimer workMinutes={prefs.pomodoroLength} />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6">
        <h2 className="font-semibold mb-4">Study Tips</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Clock, color: 'text-amber-400', tip: 'Pomodoro: 25 min focus + 5 min break for better retention' },
            { icon: Flame, color: 'text-rose-400', tip: 'Review flashcards daily — spaced repetition works best with consistency' },
            { icon: BookOpen, color: 'text-indigo-400', tip: 'Take quizzes before exams to identify weak areas' },
            { icon: Target, color: 'text-emerald-400', tip: 'Shorter, frequent sessions beat long cram sessions' },
          ].map(({ icon: Icon, color, tip }) => (
            <div key={tip} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-800/30">
              <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
              <p className="text-sm text-zinc-400">{tip}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
