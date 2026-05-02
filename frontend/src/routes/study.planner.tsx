import { createFileRoute } from "@tanstack/react-router";
import { PomodoroTimer } from "../components/study/PomodoroTimer";
import { StudyStreak } from "../components/study/StudyStreak";
import { usePreferences } from "../lib/preferences";

export const Route = createFileRoute("/study/planner")({
  component: StudyPlannerPage,
});

function StudyPlannerPage() {
  const { prefs } = usePreferences();

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-zinc-100">Study Planner</h1>

      <StudyStreak streak={0} todayCompleted={false} />

      <PomodoroTimer workMinutes={prefs.pomodoroLength} />

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Tips</h2>
        <ul className="space-y-2 text-sm text-zinc-400">
          <li>• Use Pomodoro (25 min focus + 5 min break) for better retention</li>
          <li>• Review flashcards daily — spaced repetition works best with consistency</li>
          <li>• Take quizzes before exams to identify weak areas</li>
          <li>• Shorter, frequent sessions beat long cram sessions</li>
        </ul>
      </div>
    </div>
  );
}
