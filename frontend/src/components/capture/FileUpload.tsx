import { useState, useRef, useCallback } from 'react';
import { Upload, FileAudio, X } from 'lucide-react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  progress?: number;
}

const ACCEPTED_FORMATS = '.mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac';
const MAX_SIZE_MB = 500;

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
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]/30'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)]'
        }`}
        role="button"
        aria-label="Upload audio file"
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--color-text-muted)]" />
        <p className="text-white font-medium">
          Drop audio file here or click to browse
        </p>
        <p className="text-[var(--color-text-muted)] text-sm mt-2">
          mp3, mp4, m4a, wav, webm, ogg, flac — max {MAX_SIZE_MB}MB
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
      </div>

      {error && (
        <div className="bg-[var(--color-record)]/10 border border-[var(--color-record)]/40 rounded-xl p-3 text-[var(--color-record)] text-sm">
          {error}
        </div>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <FileAudio className="w-5 h-5 text-[var(--color-primary-strong)]" />
            <div>
              <p className="text-white font-medium">{selectedFile.name}</p>
              <p className="text-[var(--color-text-muted)] text-sm">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isUploading && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFile(null);
                  }}
                  className="text-[var(--color-text-muted)] hover:text-white p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onUpload(selectedFile)}
                  className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-semibold px-5 py-2 rounded-full transition-colors"
                >
                  Upload & process
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isUploading && progress !== undefined && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-[var(--color-text-muted)]">
            <span>Uploading...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-[var(--color-input)] rounded-full overflow-hidden">
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
