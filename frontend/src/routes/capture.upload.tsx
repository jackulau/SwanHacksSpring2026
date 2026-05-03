import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { FileUpload } from "../components/capture/FileUpload";
import { ProcessingStatus } from "../components/capture/ProcessingStatus";
import { PageHeader } from "../components/layout/PageHeader";
import { pb } from "../lib/pocketbase";
import { runPipeline } from "../lib/ai-pipeline";

export const Route = createFileRoute("/capture/upload")({
  component: UploadPage,
});

type PipelineStage = 'transcribing' | 'cleaning' | 'notes' | 'flashcards' | 'quiz' | 'done' | 'error';

function UploadPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pipelineStage, setPipelineStage] = useState<PipelineStage | null>(null);
  const [pipelineError, setPipelineError] = useState('');

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
      setProgress(100);
      setIsUploading(false);

      setPipelineStage('transcribing');

      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      if (!apiKey) {
        setPipelineStage('error');
        setPipelineError('VITE_OPENAI_API_KEY not set');
        return;
      }

      const whisperForm = new FormData();
      whisperForm.append('file', file);
      whisperForm.append('model', 'whisper-1');
      whisperForm.append('language', 'en');

      const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: whisperForm,
      });

      if (!whisperRes.ok) {
        throw new Error(`Whisper API error: ${whisperRes.status}`);
      }

      const whisperData = await whisperRes.json();
      const transcript = whisperData.text;

      setPipelineStage('cleaning');
      const result = await runPipeline(lecture.id, transcript);

      if (result.errors.length > 0) {
        setPipelineStage('error');
        setPipelineError(result.errors.join('; '));
      } else {
        setPipelineStage('done');
      }
    } catch (e) {
      setIsUploading(false);
      setPipelineStage('error');
      setPipelineError(e instanceof Error ? e.message : 'Upload failed');
    }
  }, []);

  return (
    <>
      <PageHeader title="Upload Lecture" subtitle="Drop in an audio file to transcribe and generate study materials" />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-3xl mx-auto">
        {pipelineStage && (
          <div className="mb-6">
            <ProcessingStatus currentStage={pipelineStage} error={pipelineError} />
          </div>
        )}

        {!pipelineStage && (
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-5">
            <FileUpload onUpload={handleUpload} isUploading={isUploading} progress={progress} />
          </div>
        )}
      </div>
    </>
  );
}
