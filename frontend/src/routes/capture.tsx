import { createFileRoute, Link, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Hand, Mic, Upload } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { RecordButton } from "../components/capture/RecordButton";
import { LiveCaptions } from "../components/capture/LiveCaptions";
import { SignLanguageDetector } from "../components/capture/SignLanguageDetector";
import { ProcessingStatus } from "../components/capture/ProcessingStatus";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useLocalWhisper } from "../hooks/useLocalWhisper";
import { useMediaPipeHands } from "../hooks/useMediaPipeHands";
import { useSignLanguage } from "../hooks/useSignLanguage";
import { useWordSignRecognition } from "../hooks/useWordSignRecognition";
import { pb } from "../lib/pocketbase";
import { runPipeline } from "../lib/ai-pipeline";

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
  const [processing, setProcessing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineError, setPipelineError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const recordRegionRef = useRef<HTMLDivElement>(null);

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
    stt.disconnect();
    if (signEnabled) {
      mediapipe.stop();
      wordSign.reset();
    }
  }, [audioControls, stt, signEnabled, mediapipe, wordSign]);

  const handleToggleSign = useCallback(async () => {
    if (signEnabled) {
      mediapipe.stop();
      setSignEnabled(false);
    } else {
      if (videoRef.current) {
        if (!mediapipe.isLoaded) {
          await mediapipe.initialize(videoRef.current);
        }
        mediapipe.setOnLandmarks(handleLandmarks);
        mediapipe.start();

        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user', width: 640, height: 480 },
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch {
          // camera denied
        }
      }
      setSignEnabled(true);
    }
  }, [signEnabled, mediapipe, signLanguage]);

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
        lectureData.append('title', `Lecture ${new Date().toLocaleDateString()}`);
        lectureData.append('audio_file', blob, 'recording.webm');
        lectureData.append('duration_secs', String(audio.duration));
        lectureData.append('status', 'transcribing');
        lectureData.append('recorded_at', new Date().toISOString());
        lectureData.append('user', pb.authStore.record?.id || '');

        const lecture = await pb.collection('lectures').create(lectureData);

        const fullTranscript = stt.captions
          .filter((c) => c.isFinal)
          .map((c) => c.text)
          .join(' ');

        if (!fullTranscript.trim()) {
          setPipelineStage('error');
          setPipelineError('No speech detected in recording.');
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
  }, [audio.audioBlob, audio.duration, stt.captions]);

  const isRecording = audio.isRecording;
  const sttStatus = isRecording
    ? stt.isConnected
      ? 'Whisper transcribing'
      : stt.modelLoading
        ? `Loading model… ${stt.modelProgress}%`
        : 'Starting Whisper…'
    : 'Press record to begin';

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
                      className="w-2 h-2 rounded-full bg-[var(--color-record)] animate-pulse"
                      aria-hidden="true"
                    />
                    {formatDuration(audio.duration)}
                  </span>
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

              {!isRecording && (
                <button
                  type="button"
                  onClick={handleToggleSign}
                  aria-pressed={signEnabled}
                  className="inline-flex items-center gap-2 h-9 px-3 rounded-md text-xs font-medium border border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  <Hand className="w-3.5 h-3.5" aria-hidden="true" />
                  {signEnabled ? 'Sign language: on' : 'Enable sign language'}
                </button>
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
