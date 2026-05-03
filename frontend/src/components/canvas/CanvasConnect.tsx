/**
 * CanvasConnect — links a Canvas LMS account to Converge.
 *
 * Two paths produce the same `CanvasImportPayload`:
 *   1. Quick Sync: open Canvas in a popup; the popup runs a one-line script
 *      that uses the user's existing Canvas session cookie and posts the
 *      payload back via `window.opener.postMessage`.
 *   2. Console fallback: the user pastes the same script into Canvas's
 *      devtools console and pastes the resulting JSON here.
 *
 * Visually this is one form with one primary action — no decorative cards.
 */

import { useEffect, useRef, useState } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ChevronDown,
} from "lucide-react";

const CANVAS_URL_KEY = "converge_canvas_base_url";

const SYNC_SCRIPT_SRC = `(async()=>{try{const b=window.location.origin;const pr=await fetch("/api/v1/users/self/profile");if(!pr.ok){throw new Error("Not logged in to Canvas (status "+pr.status+")")}const u=await pr.json();const cr=await fetch("/api/v1/courses?enrollment_state=active&per_page=50&include[]=term");if(!cr.ok){throw new Error("Failed to fetch courses: "+cr.status)}const cs=await cr.json();if(!Array.isArray(cs)){throw new Error("Unexpected courses response")}const al=[];for(const c of cs){try{const r=await fetch("/api/v1/courses/"+c.id+"/assignments?per_page=100&order_by=due_at&include[]=submission");const d=await r.json();if(Array.isArray(d))al.push(...d)}catch(e){}}const p={base_url:b,user:u.name,courses:cs,assignments:al};if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"converge-canvas-sync",payload:p},"*");document.body.innerHTML='<div style="font-family:system-ui;background:#0f0f0f;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;padding:40px;text-align:center"><div style="font-size:48px">\\u2713</div><h2 style="margin:0;font-weight:600">Sent to Converge</h2><p style="color:#aaa">'+cs.length+' courses, '+al.length+' assignments. You can close this tab.</p></div>';setTimeout(()=>window.close(),3000)}else{const j=JSON.stringify(p);if(typeof copy==="function"){copy(j)}else{await navigator.clipboard.writeText(j).catch(()=>{})}console.log("%c\\u2713 Copied "+cs.length+" courses, "+al.length+" assignments","font-size:14px;color:#5fbf78;font-weight:bold");console.log("Paste into Converge \\u2192 Settings \\u2192 Canvas.")}}catch(e){if(window.opener&&!window.opener.closed){window.opener.postMessage({type:"converge-canvas-sync-error",error:e.message||String(e)},"*")}console.error("Converge sync error:",e);alert("Sync failed: "+(e.message||e))}})();`;

interface Props {
  connected: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  canvasUser: string | null;
  onImport: (jsonData: string) => Promise<void>;
  onDisconnect: () => void;
}

export function CanvasConnect({
  connected,
  syncing,
  lastSync,
  error,
  canvasUser,
  onImport,
  onDisconnect,
}: Props) {
  const [showFallback, setShowFallback] = useState(false);
  const [pasteData, setPasteData] = useState("");
  const [copied, setCopied] = useState(false);
  const [canvasUrl, setCanvasUrl] = useState<string>(
    () => localStorage.getItem(CANVAS_URL_KEY) ?? "",
  );
  const [editingUrl, setEditingUrl] = useState<boolean>(
    () => !localStorage.getItem(CANVAS_URL_KEY),
  );
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [waitingForPopup, setWaitingForPopup] = useState(false);
  const [popupError, setPopupError] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data as
        | { type: "converge-canvas-sync"; payload: unknown }
        | { type: "converge-canvas-sync-error"; error: string }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;
      if (!waitingForPopup) return;

      if (data.type === "converge-canvas-sync") {
        setWaitingForPopup(false);
        setPopupError(null);
        void onImport(JSON.stringify(data.payload));
      } else if (data.type === "converge-canvas-sync-error") {
        setWaitingForPopup(false);
        setPopupError(data.error);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [waitingForPopup, onImport]);

  useEffect(() => {
    if (!waitingForPopup) return;
    const t = window.setInterval(() => {
      if (popupRef.current && popupRef.current.closed) {
        setWaitingForPopup(false);
        window.clearInterval(t);
      }
    }, 500);
    return () => window.clearInterval(t);
  }, [waitingForPopup]);

  function saveCanvasUrl() {
    const cleaned = normalizeCanvasUrl(canvasUrl);
    if (!cleaned) return;
    localStorage.setItem(CANVAS_URL_KEY, cleaned);
    setCanvasUrl(cleaned);
    setEditingUrl(false);
  }

  function startQuickSync() {
    setPopupError(null);
    const url = normalizeCanvasUrl(canvasUrl);
    if (!url) {
      setEditingUrl(true);
      return;
    }
    const popup = window.open(url, "converge-canvas-sync", "popup,width=1100,height=800");
    if (!popup) {
      setPopupBlocked(true);
      return;
    }
    setPopupBlocked(false);
    popupRef.current = popup;
    setWaitingForPopup(true);
  }

  function copyScript() {
    void navigator.clipboard.writeText(SYNC_SCRIPT_SRC);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleManualImport() {
    if (!pasteData.trim()) return;
    await onImport(pasteData.trim());
    setPasteData("");
    setShowFallback(false);
  }

  const busy = syncing || waitingForPopup;
  const primaryLabel = syncing
    ? "Importing…"
    : waitingForPopup
      ? "Waiting for Canvas…"
      : connected
        ? "Sync now"
        : "Sync from Canvas";

  return (
    <section className="space-y-6" aria-label="Canvas connection">
      <header className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-base font-medium text-[var(--color-text)]">Canvas LMS</h2>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {connected
              ? canvasUser
                ? `Connected as ${canvasUser}.`
                : "Connected."
              : "Sync courses and assignments using your Canvas login."}
          </p>
          {connected && lastSync && (
            <p className="text-xs text-[var(--color-text-subtle)] mt-1">
              Last sync {new Date(lastSync).toLocaleString()}
            </p>
          )}
        </div>
        {connected && (
          <CheckCircle2
            className="w-5 h-5 text-[var(--color-primary-strong)] shrink-0"
            aria-label="Connected"
          />
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (editingUrl) {
            saveCanvasUrl();
          } else {
            startQuickSync();
          }
        }}
        className="space-y-4"
      >
        <label className="block">
          <span className="block text-xs font-medium text-[var(--color-text-muted)] mb-2">
            Canvas URL
          </span>
          {editingUrl || !canvasUrl ? (
            <input
              type="url"
              autoFocus
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              onBlur={() => canvasUrl.trim() && saveCanvasUrl()}
              placeholder="https://canvas.your-school.edu"
              className="w-full bg-transparent border-0 border-b border-[var(--color-border)] text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] px-0 py-2 text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          ) : (
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2">
              <span className="text-sm text-[var(--color-text)] truncate">{canvasUrl}</span>
              <button
                type="button"
                onClick={() => setEditingUrl(true)}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
              >
                Change
              </button>
            </div>
          )}
        </label>

        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-4">
            {connected && (
              <button
                type="button"
                onClick={onDisconnect}
                className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-record)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-record)] rounded-md px-2 py-1"
              >
                Disconnect
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={busy || (editingUrl && !canvasUrl.trim())}
            className="inline-flex items-center gap-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white font-semibold rounded-md px-4 py-2 text-sm transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]"
          >
            {busy ? (
              <RefreshCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <ExternalLink className="w-4 h-4" aria-hidden="true" />
            )}
            {editingUrl && !canvasUrl ? "Save URL" : primaryLabel}
          </button>
        </div>
      </form>

      {(error || popupError || popupBlocked) && (
        <div
          role="alert"
          className="flex items-start gap-2 border-l-2 border-[var(--color-record)] pl-3 py-2"
        >
          <AlertCircle
            className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-sm text-[var(--color-record)]">
            {popupError ||
              error ||
              "Popup blocked. Allow popups, or use the manual fallback below."}
          </p>
        </div>
      )}

      {waitingForPopup && (
        <div className="text-xs text-[var(--color-text-muted)] space-y-2">
          <p>
            In the Canvas popup, open the browser console (F12), paste the
            snippet, and press Enter.
          </p>
          <ScriptBox script={SYNC_SCRIPT_SRC} onCopy={copyScript} copied={copied} />
        </div>
      )}

      <details
        open={showFallback}
        onToggle={(e) => setShowFallback((e.target as HTMLDetailsElement).open)}
        className="border-t border-[var(--color-border)] pt-4"
      >
        <summary className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] cursor-pointer list-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] rounded-md">
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showFallback ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          Manual paste fallback
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--color-text-muted)]">
            1. Open Canvas, press F12, paste this in the console.
          </p>
          <ScriptBox script={SYNC_SCRIPT_SRC} onCopy={copyScript} copied={copied} />
          <p className="text-xs text-[var(--color-text-muted)]">
            2. The script copies the result. Paste it here and import.
          </p>
          <textarea
            value={pasteData}
            onChange={(e) => setPasteData(e.target.value)}
            placeholder="Paste JSON"
            rows={3}
            aria-label="Pasted Canvas data"
            className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-md px-3 py-2 text-sm font-mono text-[var(--color-text)] focus:outline-none focus:border-[var(--color-primary)] resize-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleManualImport}
              disabled={syncing || !pasteData.trim()}
              className="text-sm font-medium text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
            >
              {syncing ? "Importing…" : "Import pasted data"}
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}

function ScriptBox({
  script,
  onCopy,
  copied,
}: {
  script: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div className="relative">
      <pre className="bg-[var(--color-input)] border border-[var(--color-border)] rounded-md p-3 pr-16 text-[10px] text-[var(--color-text-muted)] font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
        {script}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy sync script"
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-2 py-1 rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
      >
        <Copy className="w-3 h-3" aria-hidden="true" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function normalizeCanvasUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  let withProto = trimmed;
  if (!/^https?:\/\//i.test(withProto)) withProto = "https://" + withProto;
  try {
    const u = new URL(withProto);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "";
  }
}
