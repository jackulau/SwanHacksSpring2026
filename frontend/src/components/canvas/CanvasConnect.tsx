import { useState } from "react";
import { Link2, Unlink, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";

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

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!baseUrl.trim() || !token.trim()) return;
    await onConnect(baseUrl.trim(), token.trim());
    setToken("");
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
            <p className="text-xs text-zinc-600 mt-1.5">
              Canvas → Account → Settings → New Access Token
            </p>
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
