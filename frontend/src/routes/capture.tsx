import { createFileRoute, useNavigate, Outlet, useMatch } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { Mic, Hand } from "lucide-react";
import { useAuth } from "../lib/auth";
import { AppShell } from "../components/layout/AppShell";
import { RecordButton } from "../components/capture/RecordButton";
import { LiveCaptions } from "../components/capture/LiveCaptions";
import { SignLanguageDetector } from "../components/capture/SignLanguageDetector";
import { ProcessingStatus } from "../components/capture/ProcessingStatus";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { useDeepgramSTT } from "../hooks/useDeepgramSTT";
import { useMediaPipeHands } from "../hooks/useMediaPipeHands";
import { useSignLanguage } from "../hooks/useSignLanguage";
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

function RecordingInterface() {
  const [audio, audioControls] = useAudioRecorder();
  const stt = useDeepgramSTT();
  const mediapipe = useMediaPipeHands();
  const [signEnabled, setSignEnabled] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineError, setPipelineError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);

  const signLanguage = useSignLanguage((word) => {
    stt.addSignCaption(word);
  });

  const handleStart = useCallback(async () => {
    await audioControls.start();
    const stream = audioControls.getStream();
    if (stream) {
      stt.connect(stream);
    }
  }, [audioControls, stt]);

  const handleStop = useCallback(async () => {
    audioControls.stop();
    stt.disconnect();
    if (signEnabled) {
      mediapipe.stop();
    }
  }, [audioControls, stt, signEnabled, mediapipe]);

  const handleToggleSign = useCallback(async () => {
    if (signEnabled) {
      mediapipe.stop();
      setSignEnabled(false);
    } else {
      if (videoRef.current) {
        if (!mediapipe.isLoaded) {
          await mediapipe.initialize(videoRef.current);
        }
        mediapipe.setOnLandmarks(signLanguage.processLandmarks);
        mediapipe.start();

        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 } });
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

  useEffect(() => {
    if (!audio.audioBlob || processing) return;

    const processAudio = async () => {
      setProcessing(true);
      setPipelineStage('transcribing');

      try {
        const lectureData = new FormData();
        lectureData.append('title', `Lecture ${new Date().toLocaleDateString()}`);
        lectureData.append('audio_file', audio.audioBlob!, 'recording.webm');
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
  }, [audio.audioBlob]);

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-zinc-100 mb-6">Record Lecture</h1>

      {pipelineStage && (
        <div className="mb-6">
          <ProcessingStatus currentStage={pipelineStage} error={pipelineError} />
        </div>
      )}

      {!processing && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <RecordButton
                isRecording={audio.isRecording}
                isPaused={audio.isPaused}
                onStart={handleStart}
                onStop={handleStop}
                onPause={audioControls.pause}
                onResume={audioControls.resume}
              />
              {audio.isRecording && (
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-zinc-300 font-mono text-lg">
                    {formatDuration(audio.duration)}
                  </span>
                </div>
              )}
            </div>

            {audio.isRecording && (
              <div className="flex items-center gap-2">
                <Mic className={`w-4 h-4 ${stt.isConnected ? 'text-green-400' : 'text-zinc-600'}`} />
                <span className="text-sm text-zinc-400">
                  {stt.isConnected ? 'STT Connected' : 'Connecting...'}
                </span>
              </div>
            )}
          </div>

          {audio.error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200 text-sm">
              {audio.error}
            </div>
          )}
          {stt.error && (
            <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 mb-6 text-red-200 text-sm">
              {stt.error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 flex flex-col" style={{ minHeight: 400 }}>
              <LiveCaptions captions={stt.captions} />
            </div>

            <div className="space-y-4">
              <video ref={videoRef} className="hidden" autoPlay playsInline muted />
              <SignLanguageDetector
                isActive={signEnabled}
                currentLandmarks={mediapipe.currentLandmarks}
                currentBuffer={signLanguage.currentBuffer}
                confidence={signLanguage.confidence}
                lastWord={signLanguage.lastWord}
                onToggle={handleToggleSign}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
