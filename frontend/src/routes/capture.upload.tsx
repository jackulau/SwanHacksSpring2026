import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useCallback, useEffect } from "react";
import { FileUpload } from "../components/capture/FileUpload";
import { ProcessingStatus } from "../components/capture/ProcessingStatus";
import { PageHeader } from "../components/layout/PageHeader";
import { ModeTabs } from "./capture";
import { pb } from "../lib/pocketbase";
import { runPipeline } from "../lib/ai-pipeline";
import { transcribeAudioFile } from "../hooks/useLocalWhisper";
import { toast } from "../lib/toasts";

export const Route = createFileRoute("/capture/upload")({
  component: UploadPage,
});

type PipelineStage = 'transcribing' | 'cleaning' | 'notes' | 'flashcards' | 'quiz' | 'done' | 'error';

/**
 * Upload route — twin of `/capture`. Drag-and-drop dropzone, then inline
 * processing status. No nested cards; the dropzone *is* the surface.
 */
function UploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineError, setPipelineError] = useState('');
  const [pipelineLectureId, setPipelineLectureId] = useState<string | null>(null);

  // Block accidental tab close while upload + pipeline are in flight.
  const inFlight =
    isUploading ||
    (pipelineStage !== null &&
      pipelineStage !== 'done' &&
      pipelineStage !== 'error');
  useEffect(() => {
    if (!inFlight) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [inFlight]);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setProgress(0);

    try {
      setProgress(20);

      const formData = new FormData();
      formData.append('title', file.name.replace(/\.[^.]+$/, ''));
      formData.append('audio_file', file);
      formData.append('status', 'transcribing');
      formData.append('recorded_at', new Date().toISOString());
      formData.append('user', pb.authStore.record?.id || '');

      setProgress(50);
      const lecture = await pb.collection('lectures').create(formData);
      setPipelineLectureId(lecture.id);
      setProgress(100);
      setIsUploading(false);

      setPipelineStage('transcribing');

      const transcript = await transcribeAudioFile(file);
      if (!transcript.trim()) {
        throw new Error('No speech detected in audio file.');
      }

      setPipelineStage('cleaning');
      const result = await runPipeline(lecture.id, transcript);

      if (result.errors.length > 0) {
        setPipelineStage('error');
        setPipelineError(result.errors.join('; '));
        toast.error('Upload pipeline errored', result.errors[0]);
      } else {
        setPipelineStage('done');
        toast.success(
          'Lecture ready',
          'Notes, flashcards, and a quiz are ready to review.',
        );
      }
    } catch (e) {
      setIsUploading(false);
      setPipelineStage('error');
      setPipelineError(e instanceof Error ? e.message : 'Upload failed');
      toast.error(
        'Upload failed',
        e instanceof Error ? e.message : undefined,
      );
    }
  }, []);

  return (
    <>
      <PageHeader
        title="Upload"
        subtitle="Drop in an audio file to transcribe and generate study materials."
        actions={<ModeTabs current="upload" />}
      />

      <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-2xl mx-auto">
        {pipelineStage && (
          <div className="mb-8">
            <ProcessingStatus
              currentStage={pipelineStage}
              error={pipelineError}
              finalAction={
                pipelineLectureId ? (
                  <Link
                    to="/lectures/$lectureId"
                    params={{ lectureId: pipelineLectureId }}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)]"
                  >
                    {pipelineStage === 'done' ? 'Open lecture →' : 'View partial result →'}
                  </Link>
                ) : null
              }
            />
          </div>
        )}

        {!pipelineStage && (
          <FileUpload
            onUpload={handleUpload}
            isUploading={isUploading}
            progress={progress}
          />
        )}
      </div>
    </>
  );
}
