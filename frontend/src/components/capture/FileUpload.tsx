import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, X, Loader2 } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  progress?: number;
}

const ACCEPTED_FORMATS = '.mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac';
const MAX_SIZE_MB = 500;

/**
 * Quiet drag-and-drop surface. No nested cards — just a dashed border
 * dropzone, a thin selected-file row, and an inline progress bar when
 * uploading. The "Upload & process" button is the page's primary action.
 */
export function FileUpload({ onUpload, isUploading, progress }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): boolean => {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_FORMATS.split(',').includes(ext)) {
      setError(`Unsupported format: ${ext}. Use mp3, mp4, m4a, wav, webm, ogg, or flac.`);
      return false;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Max ${MAX_SIZE_MB}MB.`);
      return false;
    }
    setError('');
    return true;
  }, []);

  const handleFile = useCallback(
    (file: File) => {
      if (validateFile(file)) {
        setSelectedFile(file);
      }
    },
    [validateFile],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      {!selectedFile && (
        <button
          type="button"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          aria-label="Upload audio file: drop here or click to browse"
          className={`w-full flex flex-col items-center justify-center px-8 py-16 rounded-sm border border-dashed text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] ${
            dragOver
              ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/30'
              : 'border-[var(--color-border-strong)] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]/30'
          }`}
        >
          <Upload
            className="w-8 h-8 text-[var(--color-text-muted)] mb-4"
            aria-hidden="true"
          />
          <p className="text-[var(--color-text)] text-base font-medium">
            Drop an audio file
          </p>
          <p className="text-[var(--color-text-muted)] text-sm mt-2">
            or click to browse — mp3, mp4, m4a, wav, webm, ogg, flac up to {MAX_SIZE_MB}MB
          </p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_FORMATS}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            className="hidden"
          />
        </button>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-[var(--color-record)]"
        >
          {error}
        </p>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between gap-4 px-4 py-3 rounded-sm border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center gap-3 min-w-0">
            <FileAudio
              className="w-5 h-5 text-[var(--color-primary-strong)] shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-[var(--color-text)] font-medium truncate">{selectedFile.name}</p>
              <p className="text-[var(--color-text-muted)] text-xs">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
          {!isUploading && (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                aria-label="Remove file"
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] p-2 rounded-md hover:bg-[var(--color-primary-soft)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onUpload(selectedFile)}
                className="h-10 px-4 rounded-md bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold text-sm transition-colors"
              >
                Upload & process
              </button>
            </div>
          )}
        </div>
      )}

      {isUploading && progress !== undefined && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <span className="inline-flex items-center gap-2">
              <Loader2
                className="w-3.5 h-3.5 animate-spin text-[var(--color-primary-strong)]"
                aria-hidden="true"
              />
              Uploading
            </span>
            <span className="font-mono">{Math.round(progress)}%</span>
          </div>
          <div
            className="w-full h-1 bg-[var(--color-input)] rounded-sm overflow-hidden"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
          >
            <div
              className="h-full bg-[var(--color-primary)] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
