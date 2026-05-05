import { AlertTriangle, Lightbulb, Star } from 'lucide-react';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteBlockProps {
  block: NoteBlockType;
}

/**
 * Document-style block renderer. Each block is plain typography with at most
 * an inline icon — no bordered cards, no backgrounds, no rounded chrome. The
 * surrounding NoteEditor controls vertical rhythm via the 8px spacing grid.
 */
export function NoteBlock({ block }: NoteBlockProps) {
  switch (block.type) {
    case 'heading':
      if (block.level === 1)
        return (
          <h2 className="text-2xl font-semibold text-[var(--color-text)] tracking-tight mt-8 mb-2">
            {block.text}
          </h2>
        );
      if (block.level === 2)
        return (
          <h3 className="text-lg font-semibold text-[var(--color-text)] tracking-tight mt-6 mb-2">
            {block.text}
          </h3>
        );
      return (
        <h4 className="text-base font-semibold text-[var(--color-text)] mt-4 mb-2">
          {block.text}
        </h4>
      );

    case 'paragraph':
      return (
        <p className="text-[var(--color-text-muted)] leading-7">
          {block.text}
        </p>
      );

    case 'bullet_list':
      return (
        <ul className="list-disc pl-6 space-y-1 text-[var(--color-text-muted)] leading-7 marker:text-[var(--color-text-subtle)]">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'key_term':
      return (
        <p className="text-[var(--color-text-muted)] leading-7">
          <strong className="text-[var(--color-text)] font-semibold">{block.term}</strong>
          <span className="text-[var(--color-text-subtle)]"> — </span>
          <span>{block.definition}</span>
        </p>
      );

    case 'example':
      return (
        <p className="text-[var(--color-text-muted)] leading-7">
          <span className="text-[var(--color-text-subtle)] uppercase tracking-wider text-xs font-medium mr-2">
            Example
          </span>
          {block.text}
        </p>
      );

    case 'callout': {
      const styles = {
        important: {
          icon: <Star className="w-4 h-4 text-[var(--color-record)] shrink-0 mt-1" aria-hidden="true" />,
          label: 'Important',
        },
        confusion: {
          icon: <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-1" aria-hidden="true" />,
          label: 'Common misconception',
        },
        tip: {
          icon: <Lightbulb className="w-4 h-4 text-[var(--color-primary-strong)] shrink-0 mt-1" aria-hidden="true" />,
          label: 'Tip',
        },
      };
      const s = styles[block.variant];
      return (
        <p className="flex gap-3 text-[var(--color-text-muted)] leading-7 border-l-2 border-[var(--color-border-strong)] pl-4">
          {s.icon}
          <span>
            <span className="sr-only">{s.label}: </span>
            {block.text}
          </span>
        </p>
      );
    }

    case 'code':
      return (
        <pre className="bg-[var(--color-surface-raised)] border border-[var(--color-border)] rounded-sm p-4 overflow-x-auto">
          <code className="text-sm text-[var(--color-primary-strong)] font-mono leading-6">
            {block.code}
          </code>
        </pre>
      );

    case 'quote':
      return (
        <blockquote className="border-l-2 border-[var(--color-border-strong)] pl-4 text-[var(--color-text-muted)] italic leading-7">
          {block.text}
          {block.attribution && (
            <footer className="not-italic text-sm text-[var(--color-text-subtle)] mt-2">
              — {block.attribution}
            </footer>
          )}
        </blockquote>
      );

    case 'divider':
      return <hr className="border-0 border-t border-[var(--color-border)] my-6" />;

    case 'image':
      return (
        <figure className="my-2">
          <img
            src={block.url}
            alt={block.alt || ''}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              // Hide the broken-image icon — caption (if any) still tells the story.
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
            className="rounded-sm max-w-full"
          />
          {block.caption && (
            <figcaption className="text-sm text-[var(--color-text-subtle)] mt-2">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );

    default:
      return null;
  }
}
