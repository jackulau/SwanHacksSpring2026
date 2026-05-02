import { AlertTriangle, Lightbulb, Star, Quote } from 'lucide-react';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteBlockProps {
  block: NoteBlockType;
}

export function NoteBlock({ block }: NoteBlockProps) {
  switch (block.type) {
    case 'heading':
      if (block.level === 1)
        return <h1 className="text-3xl font-bold text-zinc-100 mt-6 mb-3">{block.text}</h1>;
      if (block.level === 2)
        return <h2 className="text-2xl font-semibold text-zinc-100 mt-5 mb-2">{block.text}</h2>;
      return <h3 className="text-xl font-medium text-zinc-200 mt-4 mb-2">{block.text}</h3>;

    case 'paragraph':
      return <p className="text-zinc-300 leading-relaxed mb-3">{block.text}</p>;

    case 'bullet_list':
      return (
        <ul className="list-disc list-inside space-y-1 mb-3 text-zinc-300">
          {block.items.map((item, i) => (
            <li key={i}>{item}</li>
          ))}
        </ul>
      );

    case 'key_term':
      return (
        <div className="bg-indigo-950/50 border-l-4 border-indigo-500 p-4 mb-3 rounded-r-lg">
          <span className="font-bold text-indigo-300">{block.term}</span>
          <span className="text-zinc-300 ml-2">— {block.definition}</span>
        </div>
      );

    case 'example':
      return (
        <div className="bg-zinc-800/50 border-l-4 border-amber-500 p-4 mb-3 rounded-r-lg">
          <p className="text-sm text-amber-400 font-medium mb-1">Example</p>
          <p className="text-zinc-300">{block.text}</p>
        </div>
      );

    case 'callout': {
      const styles = {
        important: {
          bg: 'bg-red-950/30',
          border: 'border-red-500',
          icon: <Star className="w-4 h-4 text-red-400" />,
          label: 'Important',
          labelColor: 'text-red-400',
        },
        confusion: {
          bg: 'bg-orange-950/30',
          border: 'border-orange-500',
          icon: <AlertTriangle className="w-4 h-4 text-orange-400" />,
          label: 'Common Misconception',
          labelColor: 'text-orange-400',
        },
        tip: {
          bg: 'bg-green-950/30',
          border: 'border-green-500',
          icon: <Lightbulb className="w-4 h-4 text-green-400" />,
          label: 'Tip',
          labelColor: 'text-green-400',
        },
      };
      const s = styles[block.variant];
      return (
        <div className={`${s.bg} border-l-4 ${s.border} p-4 mb-3 rounded-r-lg`}>
          <div className="flex items-center gap-2 mb-1">
            {s.icon}
            <span className={`text-sm font-medium ${s.labelColor}`}>{s.label}</span>
          </div>
          <p className="text-zinc-300">{block.text}</p>
        </div>
      );
    }

    case 'code':
      return (
        <pre className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-3 overflow-x-auto">
          <code className="text-sm text-green-300 font-mono">{block.code}</code>
        </pre>
      );

    case 'quote':
      return (
        <blockquote className="border-l-4 border-zinc-600 pl-4 mb-3 flex items-start gap-2">
          <Quote className="w-4 h-4 text-zinc-500 mt-1 shrink-0" />
          <p className="text-zinc-400 italic">{block.text}</p>
        </blockquote>
      );

    case 'divider':
      return <hr className="border-zinc-700 my-4" />;

    case 'image':
      return (
        <figure className="mb-3">
          <img src={block.url} alt={block.alt || ''} className="rounded-lg max-w-full" />
          {block.alt && <figcaption className="text-sm text-zinc-500 mt-1">{block.alt}</figcaption>}
        </figure>
      );

    default:
      return null;
  }
}
