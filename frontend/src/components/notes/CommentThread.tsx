import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Check,
  CornerDownRight,
  MessageSquare,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { pb } from "../../lib/pocketbase";
import type { NoteCommentRecord } from "../../lib/types";

interface CommentThreadProps {
  pageId: string;
  userId: string;
}

/**
 * Threaded discussion attached to a note page. v1 surface:
 *   - root comments listed newest-last; one level of nested replies
 *   - new-comment textarea at the bottom (Cmd/Ctrl + Enter submits)
 *   - per-row author display name, relative timestamp, edit/delete for
 *     the author, "Resolve" toggle on roots
 *
 * The schema is multi-user from day one (`user` is a real relation), so
 * once we widen the read rule to a share-list this component stays put.
 */
export function CommentThread({ pageId, userId }: CommentThreadProps) {
  const [comments, setComments] = useState<NoteCommentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const userNames = useUserNameCache(comments.map((c) => c.user));

  /* ───── load ───── */

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    pb.collection("note_comments")
      .getFullList<NoteCommentRecord>({
        filter: `page = "${pageId}"`,
        sort: "created",
        requestKey: `note-comments-${pageId}`,
      })
      .then((rows) => {
        if (!cancelled) setComments(rows);
      })
      .catch((err) => {
        if (cancelled) return;
        // 404 (PB hasn't been restarted to pick up the migration) is
        // expected during a deploy window — show a calm placeholder
        // rather than a red error so the writing surface stays usable.
        const status = (err as { status?: number })?.status;
        if (status === 404) {
          setComments([]);
          setError("comments-unavailable");
        } else {
          setError("load-failed");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pageId]);

  /* ───── grouping ───── */

  const { roots, repliesByRoot } = useMemo(() => {
    const roots: NoteCommentRecord[] = [];
    const repliesByRoot = new Map<string, NoteCommentRecord[]>();
    for (const c of comments) {
      if (!c.parent) {
        roots.push(c);
      } else {
        const list = repliesByRoot.get(c.parent) ?? [];
        list.push(c);
        repliesByRoot.set(c.parent, list);
      }
    }
    return { roots, repliesByRoot };
  }, [comments]);

  /* ───── mutations ───── */

  const submit = useCallback(
    async (body: string, parent: string) => {
      const trimmed = body.trim();
      if (!trimmed) return;
      setSubmitting(true);
      try {
        const created = await pb
          .collection("note_comments")
          .create<NoteCommentRecord>({
            user: userId,
            page: pageId,
            parent,
            body: trimmed,
            resolved: false,
          });
        setComments((prev) => [...prev, created]);
        if (parent === "") setDraft("");
        else setReplyTo(null);
      } catch {
        setError("submit-failed");
      } finally {
        setSubmitting(false);
      }
    },
    [pageId, userId],
  );

  const toggleResolved = useCallback(
    async (c: NoteCommentRecord) => {
      try {
        const updated = await pb
          .collection("note_comments")
          .update<NoteCommentRecord>(c.id, { resolved: !c.resolved });
        setComments((prev) => prev.map((x) => (x.id === c.id ? updated : x)));
      } catch {
        setError("update-failed");
      }
    },
    [],
  );

  const saveEdit = useCallback(async () => {
    if (!editingId) return;
    const body = editingBody.trim();
    if (!body) return;
    try {
      const updated = await pb
        .collection("note_comments")
        .update<NoteCommentRecord>(editingId, { body });
      setComments((prev) => prev.map((x) => (x.id === editingId ? updated : x)));
      setEditingId(null);
      setEditingBody("");
    } catch {
      setError("update-failed");
    }
  }, [editingId, editingBody]);

  const remove = useCallback(async (id: string) => {
    if (!window.confirm("Delete this comment?")) return;
    try {
      await pb.collection("note_comments").delete(id);
      setComments((prev) => prev.filter((x) => x.id !== id && x.parent !== id));
    } catch {
      setError("delete-failed");
    }
  }, []);

  /* ───── render ───── */

  const onRootKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void submit(draft, "");
    }
  };

  if (error === "comments-unavailable") {
    return (
      <section className="mt-12 pt-6 border-t border-[var(--color-border)]">
        <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-3 font-medium inline-flex items-center gap-1.5">
          <MessageSquare className="w-3 h-3" aria-hidden="true" />
          Comments
        </div>
        <p className="text-xs text-[var(--color-text-subtle)]">
          Comments are warming up. Try again in a moment.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-12 pt-6 border-t border-[var(--color-border)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-subtle)] mb-3 font-medium inline-flex items-center gap-1.5">
        <MessageSquare className="w-3 h-3" aria-hidden="true" />
        Comments {comments.length > 0 && <span className="tabular-nums">· {comments.length}</span>}
      </div>

      {loading ? (
        <p className="text-xs text-[var(--color-text-subtle)]">Loading comments…</p>
      ) : roots.length === 0 ? (
        <p className="text-xs text-[var(--color-text-subtle)] mb-4">
          No comments yet. Start the thread below.
        </p>
      ) : (
        <ul className="space-y-3 mb-5">
          {roots.map((root) => {
            const replies = repliesByRoot.get(root.id) ?? [];
            return (
              <li
                key={root.id}
                className={
                  "rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] " +
                  (root.resolved ? "opacity-60" : "")
                }
              >
                <CommentRow
                  comment={root}
                  authorName={userNames.get(root.user) ?? "Someone"}
                  isAuthor={root.user === userId}
                  isRoot
                  editing={editingId === root.id}
                  editingBody={editingBody}
                  onStartEdit={() => {
                    setEditingId(root.id);
                    setEditingBody(root.body);
                  }}
                  onChangeEdit={setEditingBody}
                  onSaveEdit={saveEdit}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setEditingBody("");
                  }}
                  onDelete={() => remove(root.id)}
                  onToggleResolve={() => toggleResolved(root)}
                  onReply={() => setReplyTo(replyTo === root.id ? null : root.id)}
                />

                {replies.length > 0 && (
                  <ul className="border-t border-[var(--color-border)] divide-y divide-[var(--color-border)] bg-[var(--color-surface-raised)]/30">
                    {replies.map((r) => (
                      <li key={r.id} className="pl-6 relative">
                        <CornerDownRight
                          className="w-3 h-3 absolute left-2 top-3 text-[var(--color-text-subtle)]"
                          aria-hidden="true"
                        />
                        <CommentRow
                          comment={r}
                          authorName={userNames.get(r.user) ?? "Someone"}
                          isAuthor={r.user === userId}
                          isRoot={false}
                          editing={editingId === r.id}
                          editingBody={editingBody}
                          onStartEdit={() => {
                            setEditingId(r.id);
                            setEditingBody(r.body);
                          }}
                          onChangeEdit={setEditingBody}
                          onSaveEdit={saveEdit}
                          onCancelEdit={() => {
                            setEditingId(null);
                            setEditingBody("");
                          }}
                          onDelete={() => remove(r.id)}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {replyTo === root.id && (
                  <ReplyComposer
                    onSubmit={(body) => submit(body, root.id)}
                    onCancel={() => setReplyTo(null)}
                    submitting={submitting}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onRootKey}
          placeholder="Add a comment…  (Cmd/Ctrl + Enter to send)"
          rows={2}
          maxLength={4000}
          className="w-full bg-transparent border-0 outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-y"
        />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--color-border)]">
          <span className="text-[11px] text-[var(--color-text-subtle)] tabular-nums">
            {draft.length}/4000
          </span>
          <button
            type="button"
            onClick={() => void submit(draft, "")}
            disabled={submitting || !draft.trim()}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 h-7 rounded bg-[var(--color-primary)] text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Posting…" : "Comment"}
          </button>
        </div>
      </div>

      {error && error !== "comments-unavailable" && (
        <p
          role="status"
          className="mt-2 text-[11px] text-[var(--color-error)]"
        >
          Something went wrong. Please retry.
        </p>
      )}
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Single comment row.
   ═══════════════════════════════════════════════════════════════════ */

interface CommentRowProps {
  comment: NoteCommentRecord;
  authorName: string;
  isAuthor: boolean;
  isRoot: boolean;
  editing: boolean;
  editingBody: string;
  onStartEdit: () => void;
  onChangeEdit: (body: string) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onReply?: () => void;
  onToggleResolve?: () => void;
}

function CommentRow({
  comment,
  authorName,
  isAuthor,
  isRoot,
  editing,
  editingBody,
  onStartEdit,
  onChangeEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onReply,
  onToggleResolve,
}: CommentRowProps) {
  const onEditKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSaveEdit();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancelEdit();
    }
  };
  return (
    <div className="px-3 py-2.5">
      <div className="flex items-baseline gap-2 text-xs mb-1">
        <span className="font-semibold text-[var(--color-text)]">{authorName}</span>
        <span className="text-[var(--color-text-subtle)]" title={comment.created}>
          {relativeTime(comment.created)}
        </span>
        {comment.resolved && isRoot && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-success)]">
            Resolved
          </span>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={editingBody}
            onChange={(e) => onChangeEdit(e.target.value)}
            onKeyDown={onEditKey}
            rows={2}
            maxLength={4000}
            autoFocus
            className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded outline-none text-sm text-[var(--color-text)] resize-y px-2 py-1.5"
          />
          <div className="mt-1.5 flex items-center gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 h-6 rounded bg-[var(--color-primary)] text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text)] whitespace-pre-wrap break-words">
          {comment.body}
        </p>
      )}

      {!editing && (
        <div className="mt-1.5 flex items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
          {isRoot && onReply && (
            <button
              type="button"
              onClick={onReply}
              className="hover:text-[var(--color-text)] inline-flex items-center gap-1"
            >
              <CornerDownRight className="w-3 h-3" aria-hidden="true" /> Reply
            </button>
          )}
          {isRoot && onToggleResolve && (
            <button
              type="button"
              onClick={onToggleResolve}
              className="hover:text-[var(--color-text)] inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" aria-hidden="true" />
              {comment.resolved ? "Reopen" : "Resolve"}
            </button>
          )}
          {isAuthor && (
            <>
              <button
                type="button"
                onClick={onStartEdit}
                className="hover:text-[var(--color-text)] inline-flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" aria-hidden="true" /> Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="hover:text-[var(--color-error)] inline-flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" aria-hidden="true" /> Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Reply composer.
   ═══════════════════════════════════════════════════════════════════ */

function ReplyComposer({
  onSubmit,
  onCancel,
  submitting,
}: {
  onSubmit: (body: string) => void;
  onCancel: () => void;
  submitting: boolean;
}) {
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      onSubmit(body);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };
  return (
    <div className="border-t border-[var(--color-border)] p-3 bg-[var(--color-surface-raised)]/40">
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={onKey}
        rows={2}
        maxLength={4000}
        placeholder="Reply…  (Cmd/Ctrl + Enter to send)"
        className="w-full bg-[var(--color-bg)] border border-[var(--color-border)] rounded outline-none text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-subtle)] resize-y px-2 py-1.5"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => onSubmit(body)}
          disabled={submitting || !body.trim()}
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 h-6 rounded bg-[var(--color-primary)] text-white disabled:opacity-50"
        >
          Reply
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text)] inline-flex items-center gap-1"
        >
          <X className="w-3 h-3" aria-hidden="true" /> Cancel
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers.
   ═══════════════════════════════════════════════════════════════════ */

/**
 * Best-effort display-name lookup. We resolve unique user ids on demand
 * via pb.collection("users").getOne and cache the result; failures fall
 * back to a generic placeholder (the row already shows initials of the
 * record id).
 */
function useUserNameCache(userIds: string[]): Map<string, string> {
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const inflight = useRef<Set<string>>(new Set());

  useEffect(() => {
    const unique = Array.from(new Set(userIds)).filter(Boolean);
    const missing = unique.filter(
      (id) => !names.has(id) && !inflight.current.has(id),
    );
    if (missing.length === 0) return;
    let cancelled = false;
    for (const id of missing) {
      inflight.current.add(id);
      pb.collection("users")
        .getOne<{ id: string; display_name?: string; email?: string }>(id, {
          requestKey: `note-comments-user-${id}`,
        })
        .then((u) => {
          if (cancelled) return;
          const name =
            (u.display_name && u.display_name.trim()) ||
            (u.email && u.email.split("@")[0]) ||
            "Someone";
          setNames((prev) => {
            const next = new Map(prev);
            next.set(id, name);
            return next;
          });
        })
        .catch(() => undefined)
        .finally(() => {
          inflight.current.delete(id);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [userIds, names]);

  return names;
}

function relativeTime(iso: string): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return new Date(iso).toLocaleDateString();
}
