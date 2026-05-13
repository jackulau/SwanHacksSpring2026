import { useEffect, useMemo, useState } from "react";
import { pb } from "../../lib/pocketbase";
import type { NotePresenceRecord } from "../../lib/types";

interface PresenceIndicatorsProps {
  pageId: string;
  userId: string;
  displayName: string;
}

const HEARTBEAT_MS = 5_000;
const STALE_AFTER_MS = 15_000;

/**
 * Lightweight collaborative-presence chip for note pages.
 *
 * Each viewing client upserts a row in `note_presence` keyed by
 * (user, page) every 5s with `last_seen=now`. Peers subscribe over PB
 * realtime and this surface filters to rows whose last_seen is within
 * the last 15s (so a tab close that misses the cleanup delete decays
 * out within a heartbeat or two). The current user is excluded from
 * the rendered avatars — you don't need to see your own face here.
 *
 * The component is forgiving: if PB hasn't been restarted to pick up
 * the migration yet, both the heartbeat and the subscribe error out
 * 404 and we render nothing rather than nag the user.
 */
export function PresenceIndicators({
  pageId,
  userId,
  displayName,
}: PresenceIndicatorsProps) {
  const [peers, setPeers] = useState<NotePresenceRecord[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const [available, setAvailable] = useState(true);

  // Heartbeat — upsert this client's presence every 5s. We rely on the
  // unique (user, page) index: first call creates, subsequent calls
  // try update-by-id, falling back to a re-fetch on any other path.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;
    let myRecordId: string | null = null;

    const beat = async () => {
      if (cancelled) return;
      const last_seen = new Date().toISOString();
      try {
        if (myRecordId) {
          await pb
            .collection("note_presence")
            .update(myRecordId, { last_seen });
          return;
        }
        // First beat — try to find an existing row for this (user, page),
        // otherwise create one. Either way cache the id for subsequent
        // updates so we don't poll the list on every heartbeat.
        try {
          const existing = await pb
            .collection("note_presence")
            .getFirstListItem<NotePresenceRecord>(
              `user = "${userId}" && page = "${pageId}"`,
              { requestKey: `note-presence-self-${pageId}` },
            );
          if (cancelled) return;
          const updated = await pb
            .collection("note_presence")
            .update<NotePresenceRecord>(existing.id, { last_seen });
          myRecordId = updated.id;
        } catch {
          if (cancelled) return;
          const created = await pb
            .collection("note_presence")
            .create<NotePresenceRecord>({
              user: userId,
              page: pageId,
              display_name: displayName,
              last_seen,
            });
          myRecordId = created.id;
        }
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          // Collection isn't live yet — bail out gracefully.
          if (!cancelled) setAvailable(false);
        }
      }
    };

    void beat();
    const id = window.setInterval(() => void beat(), HEARTBEAT_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      // Best-effort cleanup so peers see us drop out immediately.
      if (myRecordId) {
        pb.collection("note_presence")
          .delete(myRecordId)
          .catch(() => undefined);
      }
    };
  }, [pageId, userId, displayName, available]);

  // Subscribe — keep the local peer list in sync with realtime events
  // and refresh on first mount so the chip is populated immediately.
  useEffect(() => {
    if (!available) return;
    let cancelled = false;

    const refresh = () =>
      pb
        .collection("note_presence")
        .getFullList<NotePresenceRecord>({
          filter: `page = "${pageId}"`,
          requestKey: `note-presence-list-${pageId}`,
        })
        .then((rows) => {
          if (!cancelled) setPeers(rows);
        })
        .catch((err) => {
          const status = (err as { status?: number })?.status;
          if (status === 404 && !cancelled) setAvailable(false);
        });

    void refresh();

    pb.collection("note_presence")
      .subscribe(
        "*",
        (e) => {
          const rec = e.record as unknown as NotePresenceRecord;
          if (rec.page !== pageId) return;
          setPeers((prev) => {
            if (e.action === "delete") {
              return prev.filter((p) => p.id !== rec.id);
            }
            const idx = prev.findIndex((p) => p.id === rec.id);
            if (idx === -1) return [...prev, rec];
            const next = prev.slice();
            next[idx] = rec;
            return next;
          });
        },
        { requestKey: null },
      )
      .catch(() => undefined);

    return () => {
      cancelled = true;
      pb.collection("note_presence").unsubscribe("*");
    };
  }, [pageId, available]);

  // Tick — re-evaluate the staleness window every few seconds so peers
  // who silently disappear fade out without further events.
  useEffect(() => {
    if (!available) return;
    const id = window.setInterval(() => setNow(Date.now()), 4_000);
    return () => window.clearInterval(id);
  }, [available]);

  const livePeers = useMemo(() => {
    return peers.filter((p) => {
      if (p.user === userId) return false;
      const t = p.last_seen ? Date.parse(p.last_seen) : 0;
      if (!t) return false;
      return now - t <= STALE_AFTER_MS;
    });
  }, [peers, userId, now]);

  if (!available || livePeers.length === 0) return null;

  return (
    <div
      className="flex items-center -space-x-1.5"
      aria-label={`${livePeers.length} other ${livePeers.length === 1 ? "viewer" : "viewers"}`}
    >
      {livePeers.slice(0, 4).map((p) => {
        const name = p.display_name?.trim() || "Someone";
        return (
          <span
            key={p.id}
            title={name}
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-white ring-2 ring-[var(--color-bg)] tabular-nums"
            style={{ backgroundColor: colorForName(name) }}
          >
            {initials(name)}
          </span>
        );
      })}
      {livePeers.length > 4 && (
        <span
          title={`${livePeers.length - 4} more`}
          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-semibold text-[var(--color-text)] bg-[var(--color-surface-raised)] ring-2 ring-[var(--color-bg)]"
        >
          +{livePeers.length - 4}
        </span>
      )}
    </div>
  );
}

/* ───── helpers ───── */

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Stable colour-from-name so each peer keeps the same hue between renders.
function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}
