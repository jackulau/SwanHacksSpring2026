import { AlertTriangle, Lightbulb, Star, Quote } from 'lucide-react';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteBlockProps {
  block: NoteBlockType;
}

export function NoteBlock({ block }: NoteBlockProps) {
  switch (block.type) {
    case 'heading':
      if (block.level === 1)
        return <h1 className="text-3xl font-bold text-white mt-6 mb-3">{block.text}</h1>;
      if (block.level === 2)
        return <h2 className="text-2xl font-semibold text-white mt-5 mb-2">{block.text}</h2>;
      return <h3 className="text-xl font-medium text-white mt-4 mb-2">{block.text}</h3>;

    case 'paragraph':
      return <p className="text-[var(--color-text-muted)] leading-relaxed mb-3">{block.text}</p>;

    case 'bullet_list':
      return (
        <ul className="list-disc list-inside space-y-1 mb-3 text-[var(--color-text-muted)]">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'key_term':
      return (
        <div className="bg-[var(--color-primary-soft)]/40 border-l-4 border-[var(--color-primary)] p-4 mb-3 rounded-r-lg">
          <span className="font-bold text-[var(--color-primary-strong)]">{block.term}</span>
          <span className="text-[var(--color-text-muted)] ml-2">— {block.definition}</span>
        </div>
      );

    case 'example':
      return (
        <div className="bg-[var(--color-surface-raised)] border-l-4 border-amber-500 p-4 mb-3 rounded-r-lg">
          <p className="text-sm text-amber-400 font-medium mb-1">Example</p>
          <p className="text-[var(--color-text-muted)]">{block.text}</p>
        </div>
      );

    case 'callout': {
      const styles = {
        important: {
          bg: 'bg-red-950/30',
          border: 'border-[var(--color-record)]',
          icon: <Star className="w-4 h-4 text-[var(--color-record)]" />,
          label: 'Important',
          labelColor: 'text-[var(--color-record)]',
        },
        confusion: {
          bg: 'bg-orange-950/30',
          border: 'border-orange-500',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
          label: 'Common Misconception',
          labelColor: 'text-orange-400',
        },
        tip: {
          bg: 'bg-[var(--color-primary-soft)]/40',
          border: 'border-[var(--color-primary)]',
          icon: <Lightbulb className="w-4 h-4 text-[var(--color-primary-strong)]" />,
          label: 'Tip',
          labelColor: 'text-[var(--color-primary-strong)]',
        },
      };
      const s = styles[block.variant];
      return (
        <div className={`${s.bg} border-l-4 ${s.border} p-4 mb-3 rounded-r-lg`}>
          <div className="flex items-center gap-2 mb-1">
            {s.icon}
            <span className={`text-sm font-medium ${s.labelColor}`}>{s.label}</span>
          </div>
          <p className="text-[var(--color-text-muted)]">{block.text}</p>
        </div>
      );
    }

    case 'code':
      return (
        <pre className="bg-black border border-[var(--color-border)] rounded-lg p-4 mb-3 overflow-x-auto">
          <code className="text-sm text-[var(--color-primary-strong)] font-mono">{block.code}</code>
        </pre>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 border-[var(--color-border-strong)] pl-4 mb-3 flex items-start gap-2">
          <Quote className="w-4 h-4 text-[var(--color-text-subtle)] mt-1 shrink-0" />
          <p className="text-[var(--color-text-muted)] italic">{block.text}</p>
        </blockquote>
      );

    case 'divider':
      return <hr className="border-[var(--color-border)] my-4" />;

    case 'image':
      return (
        <figure className="mb-3">
          <img src={block.url} alt={block.alt || ''} className="rounded-lg max-w-full" />
          {block.alt && <figcaption className="text-sm text-[var(--color-text-subtle)] mt-1">{block.alt}</figcaption>}
        </figure>
      );

    default:
      return null;
  }
}
