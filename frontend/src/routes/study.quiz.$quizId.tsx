import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/study/quiz/$quizId")({
  component: QuizPage,
});

function QuizPage() {
  const { quizId } = Route.useParams();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Quiz</h1>
      <p className="text-zinc-500 text-sm">Quiz: {quizId} — Coming soon</p>
    </div>
  );
}
