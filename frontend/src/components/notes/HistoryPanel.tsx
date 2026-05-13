import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { pb } from "../../lib/pocketbase";
import type { NoteBlock, NoteVersionRecord } from "../../lib/types";

interface HistoryPanelProps {
  pageId: string;
  userId: string;
  /**
   * Bumped by the host route every time a new snapshot is created so we
   * can re-fetch without subscribing to realtime. Cheap and predictable.
   */
  refreshKey: number;
  /**
   * Restore handler — receives the snapshot's title + blocks. The host
   * route is responsible for taking a "before-restore" snapshot of the
   * current state, then writing the new state.
   */
  onRestore: (snapshot: { title: string; blocks: NoteBlock[] }) => void;
}

/**
 * Lightweight version history surface for a note page. Lists the most
 * recent snapshots by created date with a Restore button per row.
 *
 * The collection is permission-walled (user-scoped list/view rules), so
 * a 404 here means the migration hasn't been applied yet — we render a
 * subtle empty state rather than an error so the editor stays usable.
 */
export function HistoryPanel({ pageId, userId, refreshKey, onRestore }: HistoryPanelProps) {
  const [versions, setVersions] = useState<NoteVersionRecord[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    pb.collection("note_versions")
      .getList<NoteVersionRecord>(1, 25, {
        filter: `page = "${pageId}" && user = "${userId}"`,
        sort: "-created",
        requestKey: `note-versions-${pageId}`,
      })
      .then((r) => {
        if (cancelled) return;
        setVersions(r.items);
        setLoaded(true);
        setUnavailable(false);
      })
      .catch(() => {
        if (cancelled) return;
        // Most likely the collection doesn't exist yet (migration not
        // applied to the running PB). Silently disable the panel.
        setVersions([]);
        setLoaded(true);
        setUnavailable(true);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId, userId, refreshKey]);

  const handleRestore = useCallback(
    (v: NoteVersionRecord) => {
      const blocks = Array.isArray(v.blocks) ? v.blocks : [];
      const ok = window.confirm(
        "Restore this snapshot? Your current state will be saved as a new snapshot first.",
      );
      if (!ok) return;
      onRestore({ title: v.title || "", blocks });
    },
    [onRestore],
  );

  if (unavailable) return null;
  if (loaded && versions.length === 0) {
    return (
      <section className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-3 font-medium inline-flex items-center gap-1.5">
          <History className="w-3 h-3" aria-hidden="true" />
          History
        </div>
        <p className="text-xs text-[var(--color-text-subtle)]">
          Snapshots are captured as you edit. None yet — keep typing.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 pt-6 border-t border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-3 font-medium inline-flex items-center gap-1.5">
        <History className="w-3 h-3" aria-hidden="true" />
        History
      </div>
      <ul className="space-y-1.5">
        {versions.map((v) => (
          <li
            key={v.id}
            className="flex items-center gap-3 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm"
          >
            <div className="flex-1 min-w-0">
              <div className="text-[var(--color-text)] truncate font-medium">
                {v.title || "Untitled"}
              </div>
              <div className="text-[11px] text-[var(--color-text-subtle)] tabular-nums">
                {formatStamp(v.created)}
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleRestore(v)}
              className="inline-flex items-center gap-1 px-2 h-7 rounded text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-text)]"
              aria-label={`Restore snapshot from ${formatStamp(v.created)}`}
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Restore
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatStamp(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const now = Date.now();
  const diff = now - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
