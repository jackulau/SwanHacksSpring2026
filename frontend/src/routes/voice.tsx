// /voice — speak-to-page composer.
//
// Big "record" button drives a `VoiceNoteRecorder` (browser
// SpeechRecognition). Finalized utterances accumulate as paragraph
// blocks; the most recent interim result renders below them as a soft
// preview so the user sees the engine "thinking". Save creates a new
// note_pages row, fires off best-effort knowledge ingestion, and
// surfaces a toast with an Open action linking to the new page.
//
// When the API isn't available (Firefox, most non-Chromium mobile),
// we render a calm explanation instead of the controls — saving the
// user the embarrassment of a button that just doesn't work.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Mic, MicOff, Save, AlertCircle } from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { toast } from "../lib/toasts";
import { ingestNote } from "../lib/knowledge/ingest";
import { VoiceNoteRecorder, type VoiceTranscript } from "../lib/voiceNotes";
import type { NoteBlock, NotePage } from "../lib/types";

export const Route = createFileRoute("/voice")({
  component: () => (
    <AppShell>
      <VoicePage />
    </AppShell>
  ),
});

function rid(): string {
  return Math.random().toString(36).slice(2, 11);
}

function defaultTitle(): string {
  const d = new Date();
  const date = d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `Voice note - ${date}`;
}

/**
 * Split a finalized utterance into rough sentences. The engine often
 * emits a single result spanning multiple sentences once it commits;
 * splitting here gives us one paragraph block per sentence, which is
 * what users expect when they re-open the note.
 */
function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  // Match sentence-ish chunks ending in . ! ? or end-of-string.
  const matches = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [trimmed];
  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

function VoicePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // The recorder is created once per page mount; React doesn't re-run
  // its constructor across re-renders.
  const recorderRef = useRef<VoiceNoteRecorder | null>(null);
  if (recorderRef.current === null) {
    recorderRef.current = new VoiceNoteRecorder();
  }
  const recorder = recorderRef.current;
  const available = recorder.available;

  const [title, setTitle] = useState(defaultTitle);
  const [recording, setRecording] = useState(false);
  const [finalChunks, setFinalChunks] = useState<string[]>([]);
  const [interim, setInterim] = useState("");
  const [saving, setSaving] = useState(false);

  // Stop the recognizer on unmount — leaving it running would keep the
  // mic indicator on after the user navigated away.
  useEffect(() => {
    return () => {
      recorder.stop();
    };
  }, [recorder]);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const onChunk = (chunk: VoiceTranscript) => {
    if (chunk.isFinal) {
      const sentences = splitSentences(chunk.text);
      if (sentences.length > 0) {
        setFinalChunks((prev) => [...prev, ...sentences]);
      }
      setInterim("");
    } else {
      setInterim(chunk.text);
    }
  };

  const start = () => {
    if (!available || recording) return;
    setRecording(true);
    recorder.start(onChunk);
  };

  const stop = () => {
    if (!recording) return;
    recorder.stop();
    setRecording(false);
    // Promote any lingering interim text to a final paragraph so it
    // isn't silently dropped on save.
    setInterim((cur) => {
      if (cur.trim()) {
        setFinalChunks((prev) => [...prev, cur.trim()]);
      }
      return "";
    });
  };

  const reset = () => {
    if (recording) recorder.stop();
    setRecording(false);
    setFinalChunks([]);
    setInterim("");
  };

  const canSave = !saving && finalChunks.length > 0 && !!user;

  const handleSave = async () => {
    if (!user || !canSave) return;
    if (recording) {
      recorder.stop();
      setRecording(false);
    }
    setSaving(true);
    try {
      const blocks: NoteBlock[] = finalChunks.map((text) => ({
        id: rid(),
        type: "paragraph",
        text,
      }));
      const created = await pb.collection("note_pages").create<NotePage>({
        user: user.id,
        title: title.trim() || defaultTitle(),
        icon: "mic",
        parent: "",
        course: "",
        lecture: "",
        blocks,
        properties: {},
        archived: false,
      });
      void ingestNote(user.id, created).catch(() => undefined);
      toast.success("Voice note saved", {
        description: created.title,
        action: {
          label: "Open",
          onClick: () => {
            navigate({ to: "/notes/$pageId", params: { pageId: created.id } });
          },
        },
      });
      // Reset the composer so the user can dictate another one without
      // navigating away.
      setFinalChunks([]);
      setInterim("");
      setTitle(defaultTitle());
    } catch (err) {
      toast.error(
        "Couldn't save voice note",
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  const wordCount = useMemo(() => {
    const all = `${finalChunks.join(" ")} ${interim}`.trim();
    if (!all) return 0;
    return all.split(/\s+/).length;
  }, [finalChunks, interim]);

  if (authLoading || !user) return null;

  return (
    <div>
      <PageHeader
        title="Voice notes"
        subtitle="Hold the button, talk, and watch your words become a fresh note."
      />
      <div className="px-4 sm:px-6 lg:px-8 pt-8 pb-16">
        <div className="max-w-2xl mx-auto">
          {!available ? <UnsupportedNotice /> : (
            <div className="space-y-6">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Voice note title"
                className="w-full bg-transparent border-0 outline-none text-2xl font-bold text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)]"
                aria-label="Voice note title"
                spellCheck
              />

              <div className="flex flex-col items-center gap-3 py-6">
                <button
                  type="button"
                  onClick={recording ? stop : start}
                  aria-pressed={recording}
                  aria-label={recording ? "Stop recording" : "Start recording"}
                  className={`relative w-28 h-28 rounded-full grid place-items-center transition-all shadow-lg focus:outline-none focus:ring-4 focus:ring-[var(--color-primary-soft)] ${
                    recording
                      ? "bg-red-500 hover:bg-red-600 text-white"
                      : "bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white"
                  }`}
                >
                  {recording ? (
                    <MicOff className="w-10 h-10" aria-hidden="true" />
                  ) : (
                    <Mic className="w-10 h-10" aria-hidden="true" />
                  )}
                  {recording && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-0 rounded-full border-4 border-red-400/60 animate-ping"
                    />
                  )}
                </button>
                <div className="text-sm text-[var(--color-text-muted)]">
                  {recording
                    ? "Listening… click to stop."
                    : finalChunks.length > 0
                      ? "Click to keep dictating."
                      : "Click to start dictating."}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 min-h-[180px]">
                {finalChunks.length === 0 && !interim ? (
                  <div className="text-sm text-[var(--color-text-subtle)]">
                    Your transcript will appear here in real time.
                  </div>
                ) : (
                  <div className="space-y-3 text-sm leading-relaxed text-[var(--color-text)]">
                    {finalChunks.map((s, i) => (
                      <p key={i}>{s}</p>
                    ))}
                    {interim && (
                      <p className="text-[var(--color-text-muted)] italic">
                        {interim}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-[var(--color-text-subtle)]">
                  {finalChunks.length} sentence
                  {finalChunks.length === 1 ? "" : "s"} · {wordCount} word
                  {wordCount === 1 ? "" : "s"}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    disabled={
                      saving || (finalChunks.length === 0 && !interim && !recording)
                    }
                    className="text-sm font-medium px-3 h-9 rounded-md text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                    className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 h-9 rounded-md transition-colors"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    {saving ? "Saving…" : "Save as note"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Calm fallback for browsers without SpeechRecognition. We don't try
 * to disguise the limitation — we just point the user at the browsers
 * that do work, plus the Quick Capture shortcut as a typed alternative.
 */
function UnsupportedNotice() {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
      <div className="flex items-start gap-3">
        <AlertCircle
          className="w-5 h-5 text-[var(--color-text-muted)] shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="space-y-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            Voice notes aren't available in this browser
          </h2>
          <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
            Live dictation uses the browser's Speech Recognition API,
            which is supported in Chrome, Edge, and Safari on iOS. Open
            Converge in one of those to use voice notes — or press
            <kbd className="mx-1 px-1.5 py-0.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-raised)] text-xs font-mono">
              Cmd/Ctrl J
            </kbd>
            anywhere in the app to type a Quick Capture instead.
          </p>
        </div>
      </div>
    </div>
  );
}
