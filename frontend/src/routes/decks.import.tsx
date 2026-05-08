import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Layers,
  Loader2,
  Upload,
} from "lucide-react";
import { AppShell } from "../components/layout/AppShell";
import { PageHeader } from "../components/layout/PageHeader";
import { useAuth } from "../lib/auth";
import { pb } from "../lib/pocketbase";
import { ingestFlashcard } from "../lib/knowledge/ingest";
import { toast } from "../lib/toasts";
import type { Flashcard } from "../lib/types";

export const Route = createFileRoute("/decks/import")({
  component: DecksImportPage,
});

interface ConvergeDeck {
  format?: string;
  deck_name?: string;
  cards?: Array<{
    front: string;
    back: string;
    tags?: string[];
    difficulty?: string;
  }>;
}

function DecksImportPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [deckName, setDeckName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const importDeck = async (file: File) => {
    if (!user || busy) return;
    setBusy(true);
    try {
      const text = await file.text();
      let cards: { front: string; back: string; tags: string[] }[] = [];
      let inferredName = deckName.trim() || file.name.replace(/\.[^.]+$/, "");
      if (file.name.endsWith(".json") || text.trim().startsWith("{")) {
        const parsed = JSON.parse(text) as ConvergeDeck;
        if (parsed.deck_name && !deckName.trim()) inferredName = parsed.deck_name;
        cards = (parsed.cards ?? []).map((c) => ({
          front: c.front,
          back: c.back,
          tags: c.tags ?? [],
        }));
      } else {
        // CSV: front,back[,tags]
        for (const line of text.split(/\r?\n/)) {
          if (!line.trim() || line.startsWith("front,back")) continue;
          const cells = parseCsvLine(line);
          if (cells.length < 2) continue;
          cards.push({
            front: cells[0] || "",
            back: cells[1] || "",
            tags: cells[2]
              ? cells[2].split(/\s+/).filter(Boolean)
              : [],
          });
        }
      }
      if (cards.length === 0) {
        toast.error("Empty file", "Couldn't find any front,back rows.");
        return;
      }
      let created = 0;
      for (const c of cards) {
        try {
          const written = await pb.collection("flashcards").create<Flashcard>({
            user: user.id,
            lecture: "",
            deck_name: inferredName || "Imported deck",
            front: c.front,
            back: c.back,
            front_image: "",
            back_image: "",
            tags: ["imported", ...c.tags],
            difficulty: "medium",
            source: "manual",
            ease_factor: 2.5,
            interval_days: 0,
            repetitions: 0,
          });
          created++;
          void ingestFlashcard(user.id, written).catch(() => undefined);
        } catch {
          // ignore
        }
      }
      toast.success(
        "Deck imported",
        `${created} card${created === 1 ? "" : "s"} into "${inferredName}".`,
      );
      navigate({ to: "/study/flashcards", search: { deck: inferredName } });
    } catch {
      toast.error("Import failed", "Bad file format?");
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || !user) return null;

  return (
    <AppShell>
      <PageHeader
        title="Import deck"
        subtitle="Upload an Anki CSV or a Converge deck JSON."
      />
      <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-2xl mx-auto space-y-4">
        <label className="block">
          <span className="block text-xs uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
            Deck name (optional)
          </span>
          <input
            value={deckName}
            onChange={(e) => setDeckName(e.target.value)}
            placeholder="Defaults to filename or file's deck_name"
            className="w-full bg-transparent border border-[var(--color-border)] rounded px-3 h-10 text-sm text-[var(--color-text)] focus:border-[var(--color-primary)] outline-none"
          />
        </label>

        <label className="rounded-md border border-dashed border-[var(--color-border)] bg-[var(--color-surface-raised)]/30 p-6 text-center cursor-pointer hover:border-[var(--color-primary)] block">
          <input
            type="file"
            accept=".json,.csv,.tsv,application/json,text/csv,text/tab-separated-values"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importDeck(f);
            }}
            disabled={busy}
            className="hidden"
          />
          <Upload
            className="w-5 h-5 mx-auto text-[var(--color-text-muted)] mb-2"
            aria-hidden="true"
          />
          <div className="text-sm text-[var(--color-text)]">
            {busy ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Importing…
              </span>
            ) : (
              "Choose a .json or .csv to import"
            )}
          </div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">
            JSON: Converge deck format · CSV: front,back[,tags]
          </div>
        </label>

        <a
          href="/decks"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          <Layers className="w-3 h-3" aria-hidden="true" />
          Browse existing decks <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </a>
      </div>
    </AppShell>
  );
}

/**
 * Parse one CSV line, respecting double-quoted fields with embedded
 * commas and "" escaping. Good enough for Anki's CSV export and the
 * mirror of deckToAnkiCsv we ship; not a full RFC4180 implementation.
 */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') quoted = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out.map((s) => s.replace(/<br\s*\/?>/gi, "\n"));
}
