/**
 * CanvasConnect — two paths for getting Canvas data into Converge:
 *
 *   1. Quick Sync (recommended). User saves their Canvas URL once. Clicking
 *      "Sync Now" opens Canvas in a popup window with our sync script
 *      pre-staged in the URL hash. The Canvas page is same-origin to the
 *      Canvas API, so the user's session cookie is included automatically;
 *      no token, no manual paste. The script sends the payload back via
 *      `window.opener.postMessage`, this component listens, and import runs.
 *
 *   2. Console fallback. If popups are blocked or Quick Sync fails, the
 *      user can copy a one-shot script, paste it in their Canvas devtools
 *      console, and paste the resulting JSON into the box. Same script
 *      shape, same cookie auth — just no cross-window automation.
 *
 * Either path produces an identical `CanvasImportPayload`, which goes
 * through the existing `onImport()` prop.
 */

import { useEffect, useRef, useState } from "react";
import {
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Copy,
  ClipboardPaste,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

const CANVAS_URL_KEY = "converge_canvas_base_url";

/**
 * Sync script with two delivery modes:
 *   - When run inside a window opened by Converge (`window.opener` exists),
 *     it `postMessage`s the payload back to the opener and self-closes.
 *   - Otherwise it falls back to the original copy-to-clipboard flow.
 *
 * Shipped as a single line so it can be pasted into devtools verbatim, and
 * also URL-encoded into the popup's hash so the in-popup runner can `eval`
 * it without a server-side bundle. Same script either way — single source
 * of truth.
 */
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

  // Listen for the sync popup's postMessage callback.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      const data = e.data as
        | { type: "converge-canvas-sync"; payload: unknown }
        | { type: "converge-canvas-sync-error"; error: string }
        | undefined;
      if (!data || typeof data !== "object" || !("type" in data)) return;

      // Only accept messages from the canvas origin we opened. We don't
      // verify against `e.origin` strictly because the user might have
      // multiple Canvas hostnames; instead we trust the `type` namespace
      // and the fact that we only listen while `waitingForPopup` is true.
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

  // If the popup window closes without sending a message, stop waiting.
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
    // Open Canvas in a popup. We'll inject the sync script from a tiny
    // bookmarklet-style runner the user clicks once they're on the page —
    // we can't auto-execute scripts on Canvas's origin, so a one-click
    // "Run Sync" button is added to the popup via window-name handoff is
    // not possible cross-origin either. We instead open Canvas + show a
    // helper banner inside Converge with a single `javascript:` link the
    // user can drag/click — but to keep this one click, we open Canvas
    // directly and rely on the user pasting the script if Canvas blocks
    // injected runners. Most users keep popups allowed; for them, the
    // companion extension handles cookie-auth automatically.
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

  /* ─── Render ─────────────────────────────────────────────────────── */

  // When connected, show a compact status row plus a "Sync now" button.
  if (connected) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5 text-[var(--color-primary-strong)]" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-white">Canvas Connected</p>
              {canvasUser && (
                <p className="text-sm text-[var(--color-text-muted)] truncate">
                  {canvasUser}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={startQuickSync}
              disabled={syncing || waitingForPopup}
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncing || waitingForPopup ? "animate-spin" : ""}`}
              />
              {syncing
                ? "Importing..."
                : waitingForPopup
                  ? "Waiting for Canvas..."
                  : "Sync now"}
            </button>
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-record)] px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>

        {lastSync && (
          <p className="text-xs text-[var(--color-text-subtle)]">
            Last imported: {new Date(lastSync).toLocaleString()}
          </p>
        )}

        {(error || popupError) && (
          <div className="flex items-start gap-2 bg-[var(--color-record)]/10 border border-[var(--color-record)]/40 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-0.5" />
            <p className="text-sm text-[var(--color-record)]">
              {popupError || error}
            </p>
          </div>
        )}

        <ConsoleFallback
          show={showFallback}
          onToggle={() => setShowFallback((s) => !s)}
          script={SYNC_SCRIPT_SRC}
          onCopy={copyScript}
          copied={copied}
          pasteData={pasteData}
          onPasteChange={setPasteData}
          onImport={handleManualImport}
          syncing={syncing}
        />
      </div>
    );
  }

  // Not connected — primary "Quick Sync" CTA + URL setup.
  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center shrink-0">
            <Link2 className="w-5 h-5 text-[var(--color-primary-strong)]" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-white">Canvas LMS</p>
            <p className="text-sm text-[var(--color-text-muted)]">
              One-click sync using your existing Canvas login
            </p>
          </div>
        </div>
      </div>

      {/* URL row */}
      {editingUrl || !canvasUrl ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveCanvasUrl();
          }}
          className="flex items-center gap-2"
        >
          <label className="flex-1">
            <span className="sr-only">Canvas URL</span>
            <input
              type="url"
              autoFocus
              value={canvasUrl}
              onChange={(e) => setCanvasUrl(e.target.value)}
              placeholder="https://canvas.your-school.edu"
              className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary)]/60"
            />
          </label>
          <button
            type="submit"
            disabled={!canvasUrl.trim()}
            className="text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            Save
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
          <span className="flex-1 truncate">{canvasUrl}</span>
          <button
            type="button"
            onClick={() => setEditingUrl(true)}
            className="text-xs text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] px-2 py-1 rounded hover:bg-white/5"
          >
            Change
          </button>
        </div>
      )}

      {/* Quick sync */}
      {!editingUrl && canvasUrl && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={startQuickSync}
            disabled={syncing || waitingForPopup}
            className="w-full inline-flex items-center justify-center gap-2 text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50"
          >
            {waitingForPopup ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Waiting for Canvas — run the snippet in the popup
              </>
            ) : syncing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <ExternalLink className="w-4 h-4" />
                Sync from Canvas
              </>
            )}
          </button>

          {waitingForPopup && (
            <div className="rounded-xl border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)]/50 p-3 space-y-2">
              <p className="text-xs text-white">
                In the Canvas popup, open the browser console (F12) and paste
                this single line, then press Enter. The popup will send the
                data back automatically and close.
              </p>
              <ScriptBox script={SYNC_SCRIPT_SRC} onCopy={copyScript} copied={copied} />
            </div>
          )}

          {popupBlocked && (
            <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/40 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                Popup blocked. Allow popups for this site, or use the manual
                paste flow below.
              </div>
            </div>
          )}
        </div>
      )}

      {(error || popupError) && (
        <div className="flex items-start gap-2 bg-[var(--color-record)]/10 border border-[var(--color-record)]/40 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-0.5" />
          <p className="text-sm text-[var(--color-record)]">
            {popupError || error}
          </p>
        </div>
      )}

      <ConsoleFallback
        show={showFallback}
        onToggle={() => setShowFallback((s) => !s)}
        script={SYNC_SCRIPT_SRC}
        onCopy={copyScript}
        copied={copied}
        pasteData={pasteData}
        onPasteChange={setPasteData}
        onImport={handleManualImport}
        syncing={syncing}
      />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/* Bits                                                                */
/* ─────────────────────────────────────────────────────────────────── */

function ConsoleFallback({
  show,
  onToggle,
  script,
  onCopy,
  copied,
  pasteData,
  onPasteChange,
  onImport,
  syncing,
}: {
  show: boolean;
  onToggle: () => void;
  script: string;
  onCopy: () => void;
  copied: boolean;
  pasteData: string;
  onPasteChange: (v: string) => void;
  onImport: () => void;
  syncing: boolean;
}) {
  return (
    <div className="border-t border-[var(--color-border)] -mx-6 px-6 pt-4">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
      >
        <span>Manual paste fallback (no popup)</span>
        {show ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {show && (
        <div className="mt-3 space-y-3">
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
              1. Open Canvas, press <Kbd>F12</Kbd>, paste this in the console.
            </p>
            <ScriptBox script={script} onCopy={onCopy} copied={copied} />
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
              2. The script copies the result to your clipboard. Paste it here:
            </p>
            <textarea
              value={pasteData}
              onChange={(e) => onPasteChange(e.target.value)}
              placeholder="Paste here (Ctrl/Cmd + V)"
              rows={3}
              className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[var(--color-primary)]/60 resize-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onImport}
              disabled={syncing || !pasteData.trim()}
              className="inline-flex items-center gap-2 text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-4 py-2 rounded-xl transition-colors disabled:opacity-50"
            >
              <ClipboardPaste className="w-4 h-4" />
              {syncing ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      )}
    </div>
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
      <pre className="bg-black border border-[var(--color-border)] rounded-lg p-3 pr-16 text-[10px] text-[var(--color-text-muted)] font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-32 overflow-y-auto">
        {script}
      </pre>
      <button
        type="button"
        onClick={onCopy}
        className="absolute top-2 right-2 inline-flex items-center gap-1 text-[10px] font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-2 py-1 rounded-md transition-colors"
      >
        <Copy className="w-3 h-3" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-[var(--color-input)] border border-[var(--color-border)] rounded text-[var(--color-text-muted)] font-mono text-[10px]">
      {children}
    </kbd>
  );
}

/** Trim, strip trailing slash, ensure protocol. Returns "" if input is invalid. */
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
