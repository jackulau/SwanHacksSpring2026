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
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-indigo-500 bg-indigo-500/10'
            : 'border-zinc-700 hover:border-zinc-500'
        }`}
        role="button"
        aria-label="Upload audio file"
      >
        <Upload className="w-12 h-12 mx-auto mb-4 text-zinc-500" />
        <p className="text-zinc-300 font-medium">
          Drop audio file here or click to browse
        </p>
        <p className="text-zinc-500 text-sm mt-2">
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
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200 text-sm">
          {error}
        </div>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between bg-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <FileAudio className="w-5 h-5 text-indigo-400" />
            <div>
              <p className="text-zinc-100 font-medium">{selectedFile.name}</p>
              <p className="text-zinc-500 text-sm">
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
                  className="text-zinc-500 hover:text-zinc-300"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onUpload(selectedFile)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  Upload & Process
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {isUploading && progress !== undefined && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-zinc-400">
            <span>Uploading...</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
