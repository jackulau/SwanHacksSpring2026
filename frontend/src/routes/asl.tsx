import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  Camera,
  CameraOff,
  FilePlus,
  Hand,
  HelpCircle,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import {
  ALL_PROVIDER_IDS,
  resolveProvider,
  StubProvider,
  type VlmProvider,
  type VlmProviderId,
} from "../lib/asl/providers";
import {
  AslPipeline,
  DEFAULT_PIPELINE_SETTINGS,
  type PipelineSettings,
  type SegmentResult,
} from "../lib/asl/pipeline";
import { HandsOverlay } from "../lib/asl/handsOverlay";
import { aslSessionToNotePage } from "../lib/asl/toNote";
import type { AslSegmentRecord } from "../lib/types";
import { toast } from "../lib/toasts";

export const Route = createFileRoute("/asl")({
  component: AslPage,
});

interface ChatRow {
  id: string;
  ts: number;
  transcription: string;
  confidence: number;
  durationMs: number;
  provider: VlmProviderId;
  frames: string[];
  resigned?: boolean;
  recordId?: string;
}

function AslPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pipelineRef = useRef<AslPipeline | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<HandsOverlay | null>(null);
  const sessionIdRef = useRef<string>(
    `asl_${Math.random().toString(36).slice(2, 10)}`,
  );

  const [streaming, setStreaming] = useState(false);
  const [running, setRunning] = useState(false);
  const [signing, setSigning] = useState(false);
  const [chat, setChat] = useState<ChatRow[]>([]);
  const [providerId, setProviderId] = useState<VlmProviderId>(
    () => loadAslPref<VlmProviderId>("provider", "google"),
  );
  const [provider, setProvider] = useState<VlmProvider>(new StubProvider());
  const [settings, setSettings] = useState<PipelineSettings>(() =>
    loadAslPref<PipelineSettings>("settings", DEFAULT_PIPELINE_SETTINGS),
  );
  const [overlayEnabled, setOverlayEnabled] = useState<boolean>(() =>
    loadAslPref<boolean>("overlay", true),
  );

  useEffect(() => {
    saveAslPref("provider", providerId);
  }, [providerId]);
  useEffect(() => {
    saveAslPref("settings", settings);
  }, [settings]);
  useEffect(() => {
    saveAslPref("overlay", overlayEnabled);
  }, [overlayEnabled]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [replay, setReplay] = useState<ChatRow | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    let cancelled = false;
    void resolveProvider(providerId).then((p) => {
      if (!cancelled) {
        setProvider(p);
        pipelineRef.current?.setProvider(p);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [providerId]);

  // Load any prior segments from this user so the chat continues
  // across reloads — mirrors the chat-history affordance Notion gets
  // for free.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    pb.collection("asl_segments")
      .getList<AslSegmentRecord>(1, 30, {
        filter: `user = "${user.id}"`,
        sort: "-created",
        requestKey: "asl-history",
      })
      .then((page) => {
        if (cancelled) return;
        const rows: ChatRow[] = page.items.reverse().map((r) => ({
          id: r.id,
          recordId: r.id,
          ts: new Date(r.created).getTime(),
          transcription: r.transcription || "[unclear]",
          confidence: r.confidence ?? 0,
          durationMs: r.duration_ms ?? 0,
          provider: (r.provider as VlmProviderId) || "stub",
          frames:
            (r.frames || [])
              .map((f) => f.data_url ?? "")
              .filter(Boolean) ?? [],
          resigned: r.resigned,
        }));
        setChat(rows);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user]);

  const startCamera = async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => undefined);
      setStreaming(true);
    } catch {
      toast.error(
        "Camera blocked",
        "Grant camera permission in your browser and try again.",
      );
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject as MediaStream | null;
    stream?.getTracks().forEach((t) => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setStreaming(false);
    setRunning(false);
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    overlayRef.current?.stop();
    overlayRef.current = null;
  };

  // Overlay lifecycle. We tie the overlay to (streaming + overlayEnabled) so
  // toggling either side cleanly tears down the model + RAF loop. Visualisation
  // only — the recognition pipeline owns its own MediaPipe instance.
  useEffect(() => {
    if (!streaming || !overlayEnabled) {
      overlayRef.current?.stop();
      overlayRef.current = null;
      return;
    }
    const video = videoRef.current;
    const canvas = overlayCanvasRef.current;
    if (!video || !canvas) return;
    if (overlayRef.current) return;
    const overlay = new HandsOverlay({ video, canvas });
    overlayRef.current = overlay;
    void overlay.start();
    return () => {
      overlay.stop();
      if (overlayRef.current === overlay) overlayRef.current = null;
    };
  }, [streaming, overlayEnabled]);

  const handleResult = useCallback((r: SegmentResult) => {
    const row: ChatRow = {
      id: r.id,
      ts: Date.now(),
      transcription: r.result.transcription,
      confidence: r.result.confidence,
      durationMs: r.durationMs,
      provider: provider.id,
      frames: r.frames.map((f) => `data:image/jpeg;base64,${f}`),
    };
    setChat((prev) => [...prev, row]);
  }, [provider]);

  const startPipeline = () => {
    if (!videoRef.current || running) return;
    pipelineRef.current = new AslPipeline({
      video: videoRef.current,
      provider,
      settings,
      sessionId: sessionIdRef.current,
      userId: user?.id ?? null,
      persist: true,
      onResult: handleResult,
      onEvent: (e) => {
        if (e.type === "segment_start") setSigning(true);
        if (e.type === "segment_end" || e.type === "result") setSigning(false);
      },
    });
    pipelineRef.current.start();
    setRunning(true);
  };

  const pausePipeline = () => {
    pipelineRef.current?.stop();
    pipelineRef.current = null;
    setRunning(false);
    setSigning(false);
  };

  const resignSegment = async (row: ChatRow) => {
    setReplay(row);
    if (!pipelineRef.current) {
      // Build a transient pipeline just for the resign.
      const tmp = new AslPipeline({
        video: videoRef.current!,
        provider,
        sessionId: sessionIdRef.current,
        userId: user?.id ?? null,
        persist: false,
      });
      try {
        const frames = row.frames.map((d) =>
          d.replace(/^data:image\/[^;]+;base64,/, ""),
        );
        const r = await tmp.transcribeFrames(frames);
        setChat((prev) =>
          prev.map((p) =>
            p.id === row.id
              ? {
                  ...p,
                  transcription: r.transcription,
                  confidence: r.confidence,
                  resigned: true,
                }
              : p,
          ),
        );
        if (row.recordId) {
          void pb
            .collection("asl_segments")
            .update(row.recordId, {
              transcription: r.transcription,
              confidence: r.confidence,
              resigned: true,
            })
            .catch(() => undefined);
        }
      } catch {
        // best-effort
      }
    }
  };

  const removeRow = async (row: ChatRow) => {
    setChat((prev) => prev.filter((p) => p.id !== row.id));
    if (row.recordId) {
      try {
        await pb.collection("asl_segments").delete(row.recordId);
      } catch {
        // noop
      }
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="ASL"
        subtitle="Sign on camera; transcriptions stream into the chat."
      />

      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <div className="space-y-3">
          <div className="relative rounded-md overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] aspect-[4/3]">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover bg-black"
            />
            <canvas
              ref={overlayCanvasRef}
              aria-hidden="true"
              className={`pointer-events-none absolute inset-0 w-full h-full ${
                overlayEnabled && streaming ? "" : "hidden"
              }`}
            />
            {!streaming && (
              <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
                Camera off
              </div>
            )}
            <div className="absolute top-2 left-2 right-2 flex items-center gap-2 text-[10px] uppercase tracking-wider">
              <span
                className={`inline-flex items-center gap-1 px-2 h-6 rounded-full backdrop-blur ${
                  signing
                    ? "bg-[var(--color-success)]/30 text-white"
                    : running
                    ? "bg-black/50 text-white"
                    : "bg-black/30 text-white/70"
                }`}
              >
                <Activity className="w-3 h-3" aria-hidden="true" />
                {signing ? "Signing" : running ? "Listening" : "Idle"}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 px-2 h-6 rounded-full bg-black/40 text-white/80">
                {provider.id === "stub" ? (
                  <span title="No API key configured; stub provider in use">
                    stub
                  </span>
                ) : (
                  provider.id
                )}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {!streaming ? (
              <button
                type="button"
                onClick={startCamera}
                className="inline-flex items-center gap-1.5 bg-[var(--color-primary)] text-white text-sm font-semibold px-3 h-9 rounded-md"
              >
                <Camera className="w-4 h-4" aria-hidden="true" />
                Start camera
              </button>
            ) : (
              <button
                type="button"
                onClick={stopCamera}
                className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
              >
                <CameraOff className="w-4 h-4" aria-hidden="true" />
                Stop camera
              </button>
            )}
            {streaming &&
              (running ? (
                <button
                  type="button"
                  onClick={pausePipeline}
                  className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
                >
                  <Pause className="w-4 h-4" aria-hidden="true" />
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startPipeline}
                  className="inline-flex items-center gap-1.5 bg-[var(--color-success)] text-white text-sm font-semibold px-3 h-9 rounded-md"
                >
                  <Play className="w-4 h-4" aria-hidden="true" />
                  Listen
                </button>
              ))}
            <button
              type="button"
              onClick={() => setOverlayEnabled((v) => !v)}
              aria-pressed={overlayEnabled}
              title="Toggle hand-pose overlay"
              className={`inline-flex items-center gap-1.5 border text-sm px-3 h-9 rounded-md ml-auto ${
                overlayEnabled
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              <Hand className="w-4 h-4" aria-hidden="true" />
              Overlay
            </button>
            <button
              type="button"
              disabled={chat.length === 0}
              title={
                chat.length === 0
                  ? "Sign at least one segment first."
                  : "Save this session as a note page."
              }
              onClick={async () => {
                if (!user || chat.length === 0) return;
                try {
                  const out = await aslSessionToNotePage(user.id, {
                    sessionId: sessionIdRef.current,
                  });
                  toast.success(
                    "Saved as note",
                    `${out.segmentCount} segment${out.segmentCount === 1 ? "" : "s"} captured.`,
                  );
                  navigate({
                    to: "/notes/$pageId",
                    params: { pageId: out.pageId },
                  });
                } catch {
                  toast.error("Couldn't save note", "Try again.");
                }
              }}
              className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)] disabled:opacity-50"
            >
              <FilePlus className="w-4 h-4" aria-hidden="true" />
              Save as note
            </button>
            <button
              type="button"
              onClick={() => setSettingsOpen((v) => !v)}
              aria-pressed={settingsOpen}
              className="inline-flex items-center gap-1.5 border border-[var(--color-border)] text-[var(--color-text)] text-sm px-3 h-9 rounded-md hover:bg-[var(--color-surface-raised)]"
            >
              <Settings className="w-4 h-4" aria-hidden="true" />
              Settings
            </button>
          </div>

          {settingsOpen && (
            <SettingsPanel
              providerId={providerId}
              onProviderChange={setProviderId}
              settings={settings}
              onSettingsChange={setSettings}
              onClose={() => setSettingsOpen(false)}
            />
          )}
        </div>

        <ChatSurface
          chat={chat}
          onResign={resignSegment}
          onRemove={removeRow}
          onPreviewFrame={(row) => setReplay(row)}
          reSignBelow={settings.reSignBelowConfidence}
        />
      </div>

      {replay && (
        <ReplayModal row={replay} onClose={() => setReplay(null)} />
      )}
    </AppShell>
  );
}

function SettingsPanel({
  providerId,
  onProviderChange,
  settings,
  onSettingsChange,
  onClose,
}: {
  providerId: VlmProviderId;
  onProviderChange: (id: VlmProviderId) => void;
  settings: PipelineSettings;
  onSettingsChange: (s: PipelineSettings) => void;
  onClose: () => void;
}) {
  const update = (patch: Partial<PipelineSettings>) =>
    onSettingsChange({ ...settings, ...patch });
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--color-text)]">Pipeline settings</h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close settings"
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <label className="block">
        <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
          Provider
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {ALL_PROVIDER_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onProviderChange(id)}
              className={`rounded border px-2.5 h-8 text-xs ${
                providerId === id
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-text)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)]"
              }`}
            >
              {id}
            </button>
          ))}
        </div>
      </label>

      <SliderRow
        label="Frames per segment"
        value={settings.maxFramesPerSegment}
        min={3}
        max={12}
        step={1}
        onChange={(v) => update({ maxFramesPerSegment: v })}
      />
      <SliderRow
        label="Motion threshold"
        value={settings.motionThreshold}
        min={4}
        max={48}
        step={1}
        onChange={(v) => update({ motionThreshold: v })}
      />
      <SliderRow
        label="Re-sign confidence cutoff"
        value={settings.reSignBelowConfidence}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => update({ reSignBelowConfidence: v })}
      />
      <SliderRow
        label="Sample fps"
        value={settings.sampleFps}
        min={2}
        max={12}
        step={1}
        onChange={(v) => update({ sampleFps: v })}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center justify-between text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-[var(--color-text)]">
          {step < 1 ? value.toFixed(2) : value}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function ChatSurface({
  chat,
  onResign,
  onRemove,
  onPreviewFrame,
  reSignBelow,
}: {
  chat: ChatRow[];
  onResign: (row: ChatRow) => void;
  onRemove: (row: ChatRow) => void;
  onPreviewFrame: (row: ChatRow) => void;
  reSignBelow: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);

  if (chat.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-8 text-center text-sm text-[var(--color-text-muted)] flex flex-col items-center gap-2">
        <Sparkles className="w-5 h-5" aria-hidden="true" />
        <p>
          Start the camera and press <span className="font-mono">Listen</span>.
          Sign a phrase; transcriptions land here in real time.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 max-h-[600px] overflow-y-auto space-y-2"
    >
      {chat.map((row) => {
        const isUnclear =
          row.transcription.trim() === "[unclear]" ||
          row.confidence < reSignBelow;
        return (
          <div
            key={row.id}
            className="rounded border border-[var(--color-border)] bg-[var(--color-bg)] p-3 group"
          >
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-1.5">
              <span className="tabular-nums">
                {new Date(row.ts).toLocaleTimeString()}
              </span>
              <span>·</span>
              <span>{row.provider}</span>
              <span>·</span>
              <span className="tabular-nums">
                {(row.confidence * 100).toFixed(0)}% conf
              </span>
              {row.resigned && (
                <span className="ml-1 inline-flex items-center gap-0.5 text-[var(--color-primary)]">
                  <RefreshCw className="w-2.5 h-2.5" aria-hidden="true" /> resigned
                </span>
              )}
              <span className="ml-auto">·</span>
              <span className="tabular-nums">{row.durationMs} ms</span>
              <button
                type="button"
                onClick={() => onRemove(row)}
                aria-label="Delete segment"
                className="opacity-0 group-hover:opacity-100 hover:text-[var(--color-error)] transition-opacity"
              >
                <X className="w-3 h-3" aria-hidden="true" />
              </button>
            </div>
            <div
              className={`text-base text-[var(--color-text)] ${
                isUnclear
                  ? "underline decoration-dotted decoration-[var(--color-warning)] cursor-pointer"
                  : ""
              }`}
              onClick={() => isUnclear && onResign(row)}
              title={isUnclear ? "Tap to re-sign" : undefined}
            >
              {row.transcription || "[unclear]"}
            </div>
            {row.frames.length > 0 && (
              <div className="mt-2 flex gap-1 overflow-x-auto">
                {row.frames.map((src, i) => (
                  // eslint-disable-next-line jsx-a11y/img-redundant-alt
                  <img
                    key={i}
                    src={src}
                    alt={`frame ${i + 1}`}
                    onClick={() => onPreviewFrame(row)}
                    className="h-12 rounded object-cover border border-[var(--color-border)] cursor-pointer"
                  />
                ))}
                {isUnclear && (
                  <button
                    type="button"
                    onClick={() => onResign(row)}
                    className="h-12 inline-flex items-center gap-1 border border-dashed border-[var(--color-warning)]/60 text-[var(--color-warning)] text-xs px-2 rounded hover:bg-[var(--color-warning)]/10"
                  >
                    <RefreshCw className="w-3 h-3" aria-hidden="true" />
                    Re-sign
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ReplayModal({ row, onClose }: { row: ChatRow; onClose: () => void }) {
  const [ix, setIx] = useState(0);
  useEffect(() => {
    if (row.frames.length <= 1) return;
    const id = window.setInterval(() => {
      setIx((v) => (v + 1) % row.frames.length);
    }, 200);
    return () => window.clearInterval(id);
  }, [row.frames.length]);
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative max-w-md w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close replay"
          className="absolute top-2 right-2 text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
        <div className="flex items-center gap-1 mb-2 text-xs text-[var(--color-text-muted)]">
          <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
          Frame {ix + 1} / {row.frames.length}
        </div>
        {row.frames[ix] && (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={row.frames[ix]}
            alt={`replay frame ${ix + 1}`}
            className="w-full rounded border border-[var(--color-border)]"
          />
        )}
        <div className="mt-3 text-sm text-[var(--color-text)]">
          {row.transcription || "[unclear]"}
        </div>
      </div>
    </div>
  );
}

// Suppress unused-import if any in tight builds.
function _useUnused(_v: ((...args: unknown[]) => void) | undefined) {
  return _v;
}
void useMemo;
void Loader2;
void _useUnused;

const ASL_PREF_PREFIX = "converge:asl:";

function loadAslPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(ASL_PREF_PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveAslPref<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ASL_PREF_PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
