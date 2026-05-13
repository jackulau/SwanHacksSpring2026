import { useEffect, useRef, useState } from "react";

interface MicLevelMeterProps {
  /** The active recording stream. When null/undefined, the meter is dormant. */
  stream: MediaStream | null;
  /** When false, the meter freezes at zero — useful when paused. */
  active: boolean;
  /** Number of vertical bars to render. */
  bars?: number;
}

const SMOOTHING_TIME_CONSTANT = 0.5;

/**
 * Lightweight VU-style level meter. Reads RMS amplitude from an AnalyserNode
 * tapped into the existing recording stream — does not capture extra audio
 * and adds no permission prompt.
 *
 * The meter is intentionally tiny (3 bars by default) so it can sit next to
 * the timer without drawing focus away from the transcript.
 */
export function MicLevelMeter({ stream, active, bars = 3 }: MicLevelMeterProps) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!stream || !active) {
      setLevel(0);
      return;
    }

    let cancelled = false;
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = SMOOTHING_TIME_CONSTANT;
    source.connect(analyser);

    ctxRef.current = ctx;
    sourceRef.current = source;
    analyserRef.current = analyser;

    const buf = new Uint8Array(analyser.fftSize);

    const tick = () => {
      if (cancelled) return;
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / buf.length);
      // Scale RMS into a friendly 0..1 range. A normal speaking voice tops
      // out around ~0.15 RMS; clamp + curve so the bars feel alive.
      const scaled = Math.min(1, Math.pow(rms * 4, 0.7));
      setLevel(scaled);
      rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      try {
        source.disconnect();
      } catch {
        /* already disconnected */
      }
      try {
        analyser.disconnect();
      } catch {
        /* already disconnected */
      }
      ctx.close().catch(() => {
        /* AudioContext may already be closed */
      });
      ctxRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    };
  }, [stream, active]);

  const thresholds = Array.from({ length: bars }, (_, i) => (i + 1) / bars);

  return (
    <div
      role="meter"
      aria-label="Microphone level"
      aria-valuenow={Math.round(level * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="inline-flex items-end gap-0.5 h-4"
    >
      {thresholds.map((threshold, i) => {
        const lit = level >= threshold - 1 / bars / 2;
        return (
          <span
            key={i}
            aria-hidden="true"
            className={`w-1 rounded-sm transition-colors ${
              lit ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
            }`}
            style={{ height: `${30 + i * 35}%` }}
          />
        );
      })}
    </div>
  );
}
