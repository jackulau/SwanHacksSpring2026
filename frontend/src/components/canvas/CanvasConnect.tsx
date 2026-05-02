import { useState } from "react";
import { Link2, Unlink, RefreshCw, CheckCircle, AlertCircle, Copy, Terminal, ChevronDown, ChevronUp } from "lucide-react";

const GRAB_TOKEN_SCRIPT = `// Paste this in your Canvas browser console (while logged in)
(async()=>{const c=document.querySelector('meta[name="csrf-token"]')?.content;if(!c){console.error("Not on a Canvas page or not logged in.");return}const r=await fetch("/api/v1/users/self/tokens",{method:"POST",headers:{"Content-Type":"application/json","X-CSRF-Token":c},body:JSON.stringify({token:{purpose:"HackStack"}})});const d=await r.json();if(d.token){await navigator.clipboard.writeText(d.token).catch(()=>{});console.log("%c Token: "+d.token,"font-size:16px;color:#6366f1;font-weight:bold");console.log("Copied to clipboard! Paste it in HackStack.")}else{console.error("Failed:",d)}})();`;

interface Props {
  connected: boolean;
  syncing: boolean;
  lastSync: string | null;
  error: string | null;
  canvasUser: string | null;
  onConnect: (baseUrl: string, token: string) => Promise<void>;
  onDisconnect: () => void;
  onSync: () => Promise<void>;
}

export function CanvasConnect({
  connected,
  syncing,
  lastSync,
  error,
  canvasUser,
  onConnect,
  onDisconnect,
  onSync,
}: Props) {
  const [baseUrl, setBaseUrl] = useState("");
  const [token, setToken] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!baseUrl.trim() || !token.trim()) return;
    await onConnect(baseUrl.trim(), token.trim());
    setToken("");
  }

  function copyScript() {
    navigator.clipboard.writeText(GRAB_TOKEN_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (connected) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-medium">Canvas Connected</p>
              {canvasUser && (
                <p className="text-sm text-zinc-500">{canvasUser}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onSync}
              disabled={syncing}
              className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync"}
            </button>
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Unlink className="w-3.5 h-3.5" />
              Disconnect
            </button>
          </div>
        </div>

        {lastSync && (
          <p className="text-xs text-zinc-600">
            Last synced: {new Date(lastSync).toLocaleString()}
          </p>
        )}

        {error && (
          <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/50 rounded-xl p-3">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 flex items-center justify-center">
            <Link2 className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="font-medium">Canvas LMS</p>
            <p className="text-sm text-zinc-500">
              Import courses & assignments automatically
            </p>
          </div>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors"
          >
            Connect
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleConnect} className="space-y-3 pt-2">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              Canvas URL
            </label>
            <input
              type="url"
              placeholder="https://your-school.instructure.com"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1.5">
              API Access Token
            </label>
            <input
              type="password"
              placeholder="Paste your Canvas API token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              required
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          {/* Token help */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowHelp(!showHelp)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-left"
            >
              <span className="text-xs font-medium text-zinc-400">How do I get my token?</span>
              {showHelp ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
              )}
            </button>

            {showHelp && (
              <div className="px-4 pb-4 space-y-3">
                {/* Quick method */}
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-400">Quick: Console Script</span>
                  </div>
                  <p className="text-xs text-zinc-500 mb-2">
                    Open Canvas in your browser, press <kbd className="px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300 font-mono text-[10px]">F12</kbd> to open DevTools, go to Console, and paste this:
                  </p>
                  <div className="relative">
                    <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-[11px] text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
{`// Paste in Canvas console while logged in
(async()=>{
  const c = document.querySelector(
    'meta[name="csrf-token"]'
  )?.content;
  const r = await fetch(
    "/api/v1/users/self/tokens",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": c
      },
      body: JSON.stringify({
        token: { purpose: "HackStack" }
      })
    }
  );
  const d = await r.json();
  if (d.token) {
    await navigator.clipboard.writeText(d.token)
      .catch(()=>{});
    console.log("Token: " + d.token);
    console.log("Copied to clipboard!");
  } else console.error("Failed:", d);
})();`}
                    </pre>
                    <button
                      type="button"
                      onClick={copyScript}
                      className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-medium bg-zinc-700 hover:bg-zinc-600 text-zinc-300 px-2 py-1 rounded-md transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-600 mt-1.5">
                    Token auto-copies to clipboard. Come back here and paste it.
                  </p>
                </div>

                {/* Manual method */}
                <div className="border-t border-zinc-700/50 pt-3">
                  <span className="text-xs font-semibold text-zinc-400">Manual Method</span>
                  <ol className="mt-1.5 space-y-1 text-xs text-zinc-500">
                    <li>1. Go to Canvas → click your profile picture → <strong className="text-zinc-300">Settings</strong></li>
                    <li>2. Scroll to "Approved Integrations"</li>
                    <li>3. Click <strong className="text-zinc-300">+ New Access Token</strong></li>
                    <li>4. Purpose: "HackStack", leave expiry blank</li>
                    <li>5. Click <strong className="text-zinc-300">Generate Token</strong> → copy the token</li>
                  </ol>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-1">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-zinc-400 hover:text-zinc-200 px-4 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={syncing}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {syncing ? "Connecting..." : "Connect & Sync"}
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-2 bg-red-900/20 border border-red-800/50 rounded-xl p-3">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
