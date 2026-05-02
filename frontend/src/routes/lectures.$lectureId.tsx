import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, BookOpen, Brain, HelpCircle } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { TranscriptViewer } from "../components/workspace/TranscriptViewer";
import { NoteEditor } from "../components/workspace/NoteEditor";
import { FlashcardDeck } from "../components/study/FlashcardDeck";
import { QuizRunner } from "../components/study/QuizRunner";
import { useSM2 } from "../hooks/useSM2";
import { pb } from "../lib/pocketbase";
import type { Lecture, Transcript, Note, Flashcard, Quiz, NoteBlock, QuizQuestion } from "../lib/types";
import type { QualityRating } from "../lib/sm2";

export const Route = createFileRoute("/lectures/$lectureId")({
  component: LectureDetailPage,
});

type TabKey = 'transcript' | 'notes' | 'flashcards' | 'quiz';

const TABS: { key: TabKey; label: string; icon: typeof FileText }[] = [
  { key: 'transcript', label: 'Transcript', icon: FileText },
  { key: 'notes', label: 'Notes', icon: BookOpen },
  { key: 'flashcards', label: 'Flashcards', icon: Brain },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle },
];

function LectureDetailPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { lectureId } = Route.useParams();
  const { rateCard } = useSM2();

  const [activeTab, setActiveTab] = useState<TabKey>('transcript');
  const [lecture, setLecture] = useState<Lecture | null>(null);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [notes, setNotes] = useState<Note | null>(null);
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;

    async function fetchData() {
      try {
        const lec = await pb.collection('lectures').getOne<Lecture>(lectureId);
        setLecture(lec);

        try {
          const transcripts = await pb.collection('transcripts').getFullList<Transcript>({
            filter: `lecture = "${lectureId}"`,
            sort: '-created',
          });
          if (transcripts.length > 0) setTranscript(transcripts[0]);
        } catch { /* no transcript */ }

        try {
          const notesList = await pb.collection('notes').getFullList<Note>({
            filter: `lecture = "${lectureId}"`,
            sort: '-created',
          });
          if (notesList.length > 0) setNotes(notesList[0]);
        } catch { /* no notes */ }

        try {
          const cards = await pb.collection('flashcards').getFullList<Flashcard>({
            filter: `lecture = "${lectureId}"`,
          });
          setFlashcards(cards);
        } catch { /* no cards */ }

        try {
          const quizzes = await pb.collection('quizzes').getFullList<Quiz>({
            filter: `lecture = "${lectureId}"`,
            sort: '-created',
          });
          if (quizzes.length > 0) setQuiz(quizzes[0]);
        } catch { /* no quiz */ }
      } catch {
        // lecture not found
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, lectureId]);

  if (authLoading || !user || loading) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-zinc-500">Loading...</p>
        </div>
      </AppShell>
    );
  }

  if (!lecture) {
    return (
      <AppShell>
        <div className="p-6">
          <p className="text-zinc-400">Lecture not found.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">{lecture.title}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {new Date(lecture.recorded_at).toLocaleDateString()} · {Math.ceil(lecture.duration_secs / 60)} min
          </p>
        </div>

        <div className="flex gap-1 border-b border-zinc-700 mb-6">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'transcript' && (
          <TranscriptViewer
            rawText={transcript?.raw_text || ''}
            cleanText={transcript?.clean_text || ''}
          />
        )}

        {activeTab === 'notes' && (
          <NoteEditor
            blocks={(notes?.content as NoteBlock[]) || []}
            title={notes?.title}
          />
        )}

        {activeTab === 'flashcards' && (
          flashcards.length > 0 ? (
            <FlashcardDeck
              cards={flashcards}
              onRate={(card, rating) => rateCard(card, rating as QualityRating)}
              onComplete={() => {}}
            />
          ) : (
            <p className="text-zinc-500 text-center py-12">No flashcards generated.</p>
          )
        )}

        {activeTab === 'quiz' && (
          quiz ? (
            <QuizRunner
              questions={(quiz.questions as QuizQuestion[]) || []}
              onComplete={() => {}}
            />
          ) : (
            <p className="text-zinc-500 text-center py-12">No quiz generated.</p>
          )
        )}
      </div>
    </AppShell>
  );
}
