import { createFileRoute, Link, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Hand, Mic, Upload } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { RecordButton } from "../components/capture/RecordButton";
import { LiveCaptions } from "../components/capture/LiveCaptions";
import { SignLanguageDetector } from "../components/capture/SignLanguageDetector";
import { ProcessingStatus } from "../components/capture/ProcessingStatus";
import { MicLevelMeter } from "../components/capture/MicLevelMeter";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useLocalWhisper, transcribeAudioFile } from "../hooks/useLocalWhisper";
import { useMediaPipeHands } from "../hooks/useMediaPipeHands";
import { useSignLanguage } from "../hooks/useSignLanguage";
import { useWordSignRecognition } from "../hooks/useWordSignRecognition";
import { pb } from "../lib/pocketbase";
import { runPipeline } from "../lib/ai-pipeline";
import type { Course } from "../lib/types";

const LAST_COURSE_KEY = "converge_last_capture_course";

export const Route = createFileRoute("/capture")({
  component: CapturePage,
});

function CapturePage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const childMatch = useMatch({ from: "/capture/upload", shouldThrow: false });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [loading, user, navigate]);

  if (loading || !user) return null;

  return (
    <AppShell>
      {childMatch ? <Outlet /> : <RecordingInterface />}
    </AppShell>
  );
}

type PipelineStage = 'transcribing' | 'cleaning' | 'notes' | 'flashcards' | 'quiz' | 'done' | 'error';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Map an empty-transcript outcome to a friendlier explanation. The user is
 * almost never helped by the literal "No speech detected" string — the cause
 * is usually one of: clip-too-short, mic-muted, or model still warming up.
 */
function buildNoSpeechMessage(opts: {
  durationSecs: number;
  modelLoading: boolean;
  modelProgress: number;
}): string {
  if (opts.modelLoading) {
    return `Whisper is still warming up (${opts.modelProgress}%). Try recording again in a few seconds — the model is now loaded and the next attempt should transcribe cleanly.`;
  }
  if (opts.durationSecs > 0 && opts.durationSecs < 8) {
    return `Recording was very short (${opts.durationSecs}s). Try at least 10 seconds for best results — Whisper needs a bit of audio to lock onto.`;
  }
  return "We couldn't hear anything in this recording. Check your microphone input level and that the right device is selected, then try again.";
}

const STALE_CAPTION_THRESHOLD_MS = 8000;

/**
 * Capture / Record surface.
 *
 * Layout intent (top to bottom):
 *   1. PageHeader with a Record / Upload tab toggle in the actions slot.
 *   2. Inline processing status — only when a pipeline is running.
 *   3. A single centered record affordance with timer + STT status.
 *   4. The transcript itself, as continuous typographic text.
 *   5. Sign-language panel pinned to the bottom-right corner when active,
 *      with a small toggle button when inactive.
 */
function RecordingInterface() {
  const [audio, audioControls] = useAudioRecorder();
  const stt = useLocalWhisper();
  const mediapipe = useMediaPipeHands();
  const [signEnabled, setSignEnabled] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineError, setPipelineError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordRegionRef = useRef<HTMLDivElement>(null);

  // Optional pre-record metadata. Both fields are skippable — when omitted,
  // behavior is identical to the original "Lecture {date}" / no-course flow.
  const { user: authUser } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>(() => {
    try {
      return localStorage.getItem(LAST_COURSE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [customTitle, setCustomTitle] = useState<string>("");

  useEffect(() => {
    if (!authUser) return;
    let cancelled = false;
    pb.collection("courses")
      .getFullList<Course>({
        filter: `user = "${authUser.id}"`,
        sort: "-id",
        requestKey: "capture-courses",
      })
      .then((items) => {
        if (cancelled) return;
        setCourses(items);
        // Drop the persisted selection if the course was deleted between
        // sessions — otherwise the dropdown would silently target a missing id.
        if (
          selectedCourseId &&
          !items.some((c) => c.id === selectedCourseId)
        ) {
          setSelectedCourseId("");
        }
      })
      .catch(() => {
        /* offline / not authenticated yet — leave empty */
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.id]);

  const signLanguage = useSignLanguage((word) => {
    stt.addSignCaption(word);
  });

  // Word-level recognizer (DTW against bundled WLASL + personalized
  // templates). Fires per signed word; results are emitted as ASL captions
  // alongside the letter buffer.
  const wordSign = useWordSignRecognition((label) => {
    stt.addSignCaption(label.toUpperCase());
  });

  // Both letter and word recognition consume the same MediaPipe landmark
  // stream — combine the callbacks so we only call setOnLandmarks once.
  const handleLandmarks = useCallback(
    (handData: Parameters<typeof signLanguage.processLandmarks>[0]) => {
      signLanguage.processLandmarks(handData);
      wordSign.processLandmarks(handData);
    },
    [signLanguage, wordSign],
  );

  const handleStart = useCallback(async () => {
    await audioControls.start();
    const stream = audioControls.getStream();
    if (stream) {
      stt.connect(stream);
    }
    // Move focus to the live region so AT users hear the new state.
    recordRegionRef.current?.focus();
  }, [audioControls, stt]);

  const handleStop = useCallback(async () => {
    audioControls.stop();
    // Await disconnect so the final caption chunk is appended before the
    // pipeline effect reads stt.captions. Without this, the pipeline can
    // race ahead and see an empty captions array on the last chunk.
    await stt.disconnect();
    if (signEnabled) {
      mediapipe.stop();
      wordSign.reset();
    }
  }, [audioControls, stt, signEnabled, mediapipe, wordSign]);

  const handleToggleSign = useCallback(async () => {
    if (signEnabled) {
      mediapipe.stop();
      setSignEnabled(false);
      setSignError(null);
      return;
    }

    if (!videoRef.current) return;

    // Clear any prior error before retrying.
    setSignError(null);

    // Acquire the camera FIRST. If permission is denied or no device is
    // available, surface an error and bail before mounting the detector — the
    // previous behavior swallowed the error and left the user staring at a
    // black video pane with aria-pressed=true.
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      // Surface the failure so the user can retry; keep aria-pressed=false by
      // leaving signEnabled as-is. (Browser already logs the underlying
      // NotAllowedError / NotFoundError to the console.)
      setSignError(
        "We couldn't access your camera. Check browser permissions and try again.",
      );
      setSignEnabled(false);
      return;
    }

    if (!mediapipe.isLoaded) {
      await mediapipe.initialize(videoRef.current);
    }
    mediapipe.setOnLandmarks(handleLandmarks);
    mediapipe.start();
    setSignEnabled(true);
  }, [signEnabled, mediapipe, handleLandmarks]);

  // Use a ref to guard against duplicate pipeline runs. A naive `processing`
  // state guard fails because (a) React StrictMode mounts the effect twice in
  // dev — the second mount sees `processing = false` from a stale closure and
  // re-fires; (b) any future re-render that re-runs the effect would see the
  // same stale value. The ref survives both.
  const pipelineStartedRef = useRef<Blob | null>(null);

  useEffect(() => {
    const blob = audio.audioBlob;
    if (!blob) return;
    if (pipelineStartedRef.current === blob) return;
    pipelineStartedRef.current = blob;

    const processAudio = async () => {
      setProcessing(true);
      setPipelineStage('transcribing');

      try {
        const lectureData = new FormData();
        const trimmedTitle = customTitle.trim();
        const courseForLecture = courses.find((c) => c.id === selectedCourseId);
        const fallbackTitle = courseForLecture
          ? `${courseForLecture.code || courseForLecture.name} — ${new Date().toLocaleDateString()}`
          : `Lecture ${new Date().toLocaleDateString()}`;
        lectureData.append('title', trimmedTitle || fallbackTitle);
        lectureData.append('audio_file', blob, 'recording.webm');
        lectureData.append('duration_secs', String(audio.duration));
        lectureData.append('status', 'transcribing');
        lectureData.append('recorded_at', new Date().toISOString());
        lectureData.append('user', pb.authStore.record?.id || '');
        if (selectedCourseId) {
          lectureData.append('course', selectedCourseId);
        }

        const lecture = await pb.collection('lectures').create(lectureData);

        let fullTranscript = stt.captions
          .filter((c) => c.isFinal)
          .map((c) => c.text)
          .join(' ')
          .trim();

        // Fallback: if live captioning produced nothing (short clip, late
        // model warm-up, or mostly-silent audio that filtered to [BLANK_AUDIO]
        // tokens), run a one-shot transcription over the whole saved blob
        // before declaring no-speech. The model is already loaded so this is
        // typically only a few seconds.
        if (!fullTranscript) {
          try {
            const file = new File([blob], 'recording.webm', { type: blob.type });
            fullTranscript = (await transcribeAudioFile(file)).trim();
          } catch (err) {
            console.error('[capture] batch transcription fallback failed', err);
          }
        }

        if (!fullTranscript) {
          setPipelineStage('error');
          setPipelineError(
            buildNoSpeechMessage({
              durationSecs: audio.duration,
              modelLoading: stt.modelLoading,
              modelProgress: stt.modelProgress,
            }),
          );
          return;
        }

        setPipelineStage('cleaning');
        const result = await runPipeline(lecture.id, fullTranscript);

        if (result.errors.length > 0) {
          setPipelineStage('error');
          setPipelineError(result.errors.join('; '));
        } else {
          setPipelineStage('done');
        }
      } catch (e) {
        setPipelineStage('error');
        setPipelineError(e instanceof Error ? e.message : 'Processing failed');
      }
    };

    processAudio();
    // The effect intentionally re-registers when the user changes the title,
    // course, or course list so that the closure used to build `lectureData`
    // holds the latest values when audio.audioBlob actually arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audio.audioBlob, audio.duration, stt.captions, customTitle, selectedCourseId, courses]);

  const isRecording = audio.isRecording;
  const isPaused = audio.isPaused;

  // Track the timestamp of the most recent caption update so we can flag a
  // stale caption stream while recording (Whisper occasionally falls behind
  // on heavy CPU; the user has no signal otherwise).
  const [lastCaptionAt, setLastCaptionAt] = useState<number | null>(null);
  useEffect(() => {
    if (stt.captions.length === 0) return;
    setLastCaptionAt(Date.now());
  }, [stt.captions.length]);
  useEffect(() => {
    if (!isRecording) {
      setLastCaptionAt(null);
    }
  }, [isRecording]);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (!isRecording || isPaused) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isRecording, isPaused]);
  const captionsAreStale =
    isRecording &&
    !isPaused &&
    stt.isConnected &&
    lastCaptionAt !== null &&
    now - lastCaptionAt > STALE_CAPTION_THRESHOLD_MS;

  const sttStatus = !isRecording
    ? 'Press record to begin'
    : isPaused
      ? 'Paused — captions resume on play'
      : stt.isConnected
        ? 'Whisper transcribing'
        : stt.modelLoading
          ? `Loading model… ${stt.modelProgress}%`
          : 'Starting Whisper…';

  // Hot ref to the current MediaStream — passed into the VU meter once
  // recording starts. We don't need to subscribe to changes since the
  // recorder owns the stream lifecycle.
  const recordingStream = useMemo(
    () => (isRecording ? audioControls.getStream() : null),
    [isRecording, audioControls],
  );

  return (
    <>
      <PageHeader
        title="Record"
        subtitle="Capture lecture audio with live captions and optional sign-language detection."
        actions={<ModeTabs current="record" />}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-4xl mx-auto">
        {pipelineStage && !isRecording && (
          <div className="mb-8">
            <ProcessingStatus currentStage={pipelineStage} error={pipelineError} />
          </div>
        )}

        {!processing && (
          <>
            {!isRecording && (
              <PreRecordForm
                courses={courses}
                selectedCourseId={selectedCourseId}
                onCourseChange={(id) => {
                  setSelectedCourseId(id);
                  try {
                    if (id) localStorage.setItem(LAST_COURSE_KEY, id);
                    else localStorage.removeItem(LAST_COURSE_KEY);
                  } catch {
                    /* localStorage unavailable — non-fatal */
                  }
                }}
                title={customTitle}
                onTitleChange={setCustomTitle}
              />
            )}
            {/* Record surface — centered, breathing, single primary action. */}
            <div
              ref={recordRegionRef}
              tabIndex={-1}
              aria-label="Recording controls"
              className="flex flex-col items-center gap-6 py-8 outline-none"
            >
              <RecordButton
                isRecording={audio.isRecording}
                isPaused={audio.isPaused}
                onStart={handleStart}
                onStop={handleStop}
                onPause={audioControls.pause}
                onResume={audioControls.resume}
              />

              <div className="flex items-center gap-3 text-sm">
                {isRecording && (
                  <span
                    className="inline-flex items-center gap-2 font-mono text-[var(--color-text)] tabular-nums text-base"
                    aria-live="off"
                  >
                    <span
                      className={`w-2 h-2 rounded-full bg-[var(--color-record)] ${
                        isPaused ? '' : 'animate-pulse'
                      }`}
                      aria-hidden="true"
                    />
                    {formatDuration(audio.duration)}
                  </span>
                )}
                {isRecording && (
                  <MicLevelMeter stream={recordingStream} active={!isPaused} />
                )}
                <span
                  className={
                    isRecording
                      ? 'text-[var(--color-text-muted)]'
                      : 'text-[var(--color-text-subtle)]'
                  }
                >
                  {sttStatus}
                </span>
              </div>
              {captionsAreStale && (
                <p
                  role="status"
                  className="text-xs text-[var(--color-warning)] inline-flex items-center gap-1.5 -mt-2"
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--color-warning)] animate-pulse"
                    aria-hidden="true"
                  />
                  Captions catching up — Whisper is a few seconds behind.
                </p>
              )}

              {!isRecording && (
                <div className="flex flex-col items-center gap-2">
                  <button
                    type="button"
                    onClick={handleToggleSign}
                    aria-pressed={signEnabled}
                    className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                  >
                    <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                    {signEnabled ? 'Sign language: on' : 'Enable sign language'}
                  </button>
                  {signError && (
                    <div
                      role="alert"
                      className="flex items-center gap-2 text-xs text-[var(--color-record)] max-w-md text-center"
                    >
                      <span>{signError}</span>
                      <button
                        type="button"
                        onClick={handleToggleSign}
                        className="underline underline-offset-2 hover:text-[var(--color-text)] transition-colors"
                      >
                        Try again
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(audio.error || stt.error) && (
              <p
                role="alert"
                className="mt-4 text-sm text-[var(--color-record)] text-center"
              >
                {audio.error || stt.error}
              </p>
            )}

            {/* Transcript — continuous typographic body, no card chrome. */}
            <div className="mt-12 border-t border-[var(--color-border)] pt-8">
              <LiveCaptions captions={stt.captions} />
            </div>
          </>
        )}

        {/* Hidden video element used by MediaPipe init when sign is enabled. */}
        <video ref={videoRef} className="hidden" autoPlay playsInline muted />

        {/* Sign-language detector floats in the bottom-right corner. */}
        {signEnabled && (
          <div className="fixed bottom-6 right-6 z-30">
            <SignLanguageDetector
              isActive={signEnabled}
              currentLandmarks={mediapipe.currentLandmarks}
              currentBuffer={signLanguage.currentBuffer}
              confidence={signLanguage.confidence}
              lastWord={signLanguage.lastWord}
              onToggle={handleToggleSign}
              wordRecognizer={{
                isReady: wordSign.isReady,
                loadError: wordSign.loadError,
                templateCount: wordSign.templateCount,
                segmenterState: wordSign.segmenterState,
                activeFrames: wordSign.activeFrames,
                lastWord: wordSign.lastWord,
                lastDistance: wordSign.lastDistance,
                lastCandidates: wordSign.lastCandidates,
              }}
            />
          </div>
        )}
      </div>
    </>
  );
}

/**
 * Optional pre-record metadata form. Rendered above the Record button when
 * the user is not currently recording. Both fields are entirely optional —
 * leaving them empty produces the same `Lecture {date}` / unlinked-course
 * outcome as before. The selected course id is mirrored to localStorage so
 * the next session opens with the same default.
 */
interface PreRecordFormProps {
  courses: Course[];
  selectedCourseId: string;
  onCourseChange: (id: string) => void;
  title: string;
  onTitleChange: (next: string) => void;
}

function PreRecordForm({
  courses,
  selectedCourseId,
  onCourseChange,
  title,
  onTitleChange,
}: PreRecordFormProps) {
  if (courses.length === 0) {
    // Nothing to pick — render only the title input so the form doesn't
    // confuse first-run users with an empty dropdown.
    return (
      <div className="max-w-md mx-auto -mt-2 mb-2 grid gap-2">
        <label className="block">
          <span className="block text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
            Title (optional)
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="e.g. Lecture 7 — Memory & encoding"
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
          />
        </label>
      </div>
    );
  }
  return (
    <div className="max-w-md mx-auto -mt-2 mb-2 grid gap-3">
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
          Course (optional)
        </span>
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)]"
        >
          <option value="">No course</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {[c.code, c.name].filter(Boolean).join(" · ") || "Untitled course"}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="block text-[11px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-1">
          Title (optional)
        </span>
        <input
          type="text"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Auto-titled if left blank"
          className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] focus:outline-none focus:border-[var(--color-primary)]"
        />
      </label>
    </div>
  );
}

/**
 * Compact tab toggle that lives in the page header. Switching tabs is a
 * single click — combined with the sidebar entry, recording starts in two
 * clicks total.
 */
export function ModeTabs({ current }: { current: 'record' | 'upload' }) {
  const base =
    'inline-flex items-center gap-2 h-9 px-3 rounded-md text-sm font-medium transition-colors';
  const active = 'bg-[var(--color-primary-soft)] text-[var(--color-text)]';
  const inactive =
    'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-primary-soft)]';
  return (
    <div
      role="tablist"
      aria-label="Capture mode"
      className="inline-flex items-center gap-1 p-1 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]"
    >
      <Link
        to="/capture"
        role="tab"
        aria-selected={current === 'record'}
        className={`${base} ${current === 'record' ? active : inactive}`}
      >
        <Mic className="w-4 h-4" aria-hidden="true" />
        Record
      </Link>
      <Link
        to="/capture/upload"
        role="tab"
        aria-selected={current === 'upload'}
        className={`${base} ${current === 'upload' ? active : inactive}`}
      >
        <Upload className="w-4 h-4" aria-hidden="true" />
        Upload
      </Link>
    </div>
  );
}
