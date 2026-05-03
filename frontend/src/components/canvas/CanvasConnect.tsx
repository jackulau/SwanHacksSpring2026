import { useState } from "react";
import { Link2, Unlink, RefreshCw, CheckCircle, AlertCircle, Copy, ClipboardPaste } from "lucide-react";

const IMPORT_SCRIPT = `// Paste in Canvas console while logged in
(async()=>{try{const b=window.location.origin;console.log("Fetching profile...");const pr=await fetch("/api/v1/users/self/profile");if(!pr.ok){console.error("Not logged in or not on Canvas (status "+pr.status+")");return}const u=await pr.json();console.log("Hi "+u.name+"! Fetching courses...");const cr=await fetch("/api/v1/courses?enrollment_state=active&per_page=50&include[]=term");if(!cr.ok){console.error("Failed to fetch courses: "+cr.status);return}const cs=await cr.json();if(!Array.isArray(cs)){console.error("Unexpected response:",cs);return}console.log("Found "+cs.length+" courses. Fetching assignments...");const al=[];for(const c of cs){try{const r=await fetch("/api/v1/courses/"+c.id+"/assignments?per_page=100&order_by=due_at&include[]=submission");const d=await r.json();if(Array.isArray(d))al.push(...d)}catch(e){console.warn("Skipped course "+c.id)}}console.log("Found "+al.length+" assignments.");const p=JSON.stringify({base_url:b,user:u.name,courses:cs,assignments:al});copy(p);console.log("%c✅ Data copied to clipboard!","font-size:16px;color:#5fbf78;font-weight:bold");console.log("Go to Converge Settings → Canvas → paste it in the box.")}catch(e){console.error("Script error:",e)}})();`;

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
  const [showForm, setShowForm] = useState(false);
  const [pasteData, setPasteData] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleImport() {
    if (!pasteData.trim()) return;
    await onImport(pasteData.trim());
    setPasteData("");
    setShowForm(false);
  }

  function copyScript() {
    navigator.clipboard.writeText(IMPORT_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const importForm = (
    <div className="space-y-4 pt-2">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center text-[10px] font-bold">1</div>
          <span className="text-sm font-medium">Copy this script</span>
        </div>
        <div className="relative">
          <pre className="bg-black border border-[var(--color-border)] rounded-lg p-3 text-[11px] text-[var(--color-text-muted)] font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-40 overflow-y-auto">
{`// Paste in Canvas console
(async () => {
  try {
    const b = window.location.origin;
    console.log("Fetching profile...");
    const pr = await fetch(
      "/api/v1/users/self/profile");
    if (!pr.ok) {
      console.error("Not logged in");
      return;
    }
    const u = await pr.json();
    console.log("Hi " + u.name + "!");
    const cr = await fetch(
      "/api/v1/courses?"
      + "enrollment_state=active"
      + "&per_page=50&include[]=term");
    const cs = await cr.json();
    if (!Array.isArray(cs)) {
      console.error("Bad response:", cs);
      return;
    }
    console.log(cs.length + " courses");
    const al = [];
    for (const c of cs) {
      try {
        const r = await fetch(
          "/api/v1/courses/" + c.id
          + "/assignments?per_page=100"
          + "&order_by=due_at"
          + "&include[]=submission");
        const d = await r.json();
        if (Array.isArray(d))
          al.push(...d);
      } catch (e) {}
    }
    console.log(al.length+" assignments");
    const p = JSON.stringify({
      base_url: b, user: u.name,
      courses: cs, assignments: al,
    });
    copy(p);
    console.log("Copied to clipboard!");
  } catch (e) {
    console.error("Error:", e);
  }
})();`}
          </pre>
          <button
            type="button"
            onClick={copyScript}
            className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium bg-[var(--color-input)] hover:bg-[var(--color-surface-raised)] border border-[var(--color-border)] text-[var(--color-text-muted)] px-2 py-1 rounded-md transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center text-[10px] font-bold">2</div>
          <span className="text-sm font-medium">Paste in Canvas console</span>
        </div>
        <p className="text-xs text-[var(--color-text-muted)] ml-7">
          Go to Canvas, press <kbd className="px-1.5 py-0.5 bg-[var(--color-input)] border border-[var(--color-border)] rounded text-white font-mono text-[10px]">F12</kbd>, open Console tab, paste the script, hit Enter
        </p>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)] text-black flex items-center justify-center text-[10px] font-bold">3</div>
          <span className="text-sm font-medium">Paste the result here</span>
        </div>
        <textarea
          value={pasteData}
          onChange={(e) => setPasteData(e.target.value)}
          placeholder="Data auto-copies to clipboard. Just Ctrl+V / Cmd+V here."
          rows={3}
          className="w-full bg-[var(--color-input)] border border-[var(--color-border)] rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-[var(--color-primary)]/60 focus:ring-1 focus:ring-[var(--color-primary)]/40 transition-colors resize-none"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setShowForm(false); setPasteData(""); }}
          className="text-[var(--color-text-muted)] hover:text-white px-4 py-2 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={handleImport}
          disabled={syncing || !pasteData.trim()}
          className="bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black font-medium px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <ClipboardPaste className="w-4 h-4" />
          {syncing ? "Importing..." : "Import"}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-900/20 border border-[var(--color-record)]/40 rounded-xl p-3">
          <AlertCircle className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-0.5" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}
    </div>
  );

  if (connected) {
    return (
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--color-primary-strong)]" />
            </div>
            <div>
              <p className="font-medium text-white">Canvas Connected</p>
              {canvasUser && <p className="text-sm text-[var(--color-text-muted)]">{canvasUser}</p>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(!showForm)}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm text-[var(--color-primary-strong)] hover:text-[var(--color-primary-hover)] px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Importing..." : "Re-import"}
            </button>
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-record)] px-3 py-1.5 rounded-lg hover:bg-[var(--color-surface-raised)] transition-colors"
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

        {showForm && importForm}

        {!showForm && error && (
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/50 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] soft-shadow p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-soft)] flex items-center justify-center">
            <Link2 className="w-5 h-5 text-[var(--color-primary-strong)]" />
          </div>
          <div>
            <p className="font-medium text-white">Canvas LMS</p>
            <p className="text-sm text-[var(--color-text-muted)]">Import courses & assignments</p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-black px-4 py-2 rounded-xl transition-colors"
          >
            Import
          </button>
        )}
      </div>

      {showForm && importForm}
    </div>
  );
}
