import { NoteBlock } from './NoteBlock';
import type { NoteBlock as NoteBlockType } from '../../lib/types';

interface NoteEditorProps {
  blocks: NoteBlockType[];
  title?: string;
}

export function NoteEditor({ blocks, title }: NoteEditorProps) {
  if (blocks.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[var(--color-text-muted)]">No notes generated yet.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto" data-focus-zone>
      {title && <h1 className="text-3xl font-bold text-white mb-6">{title}</h1>}
      <div className="space-y-1">
        {blocks.map((block, i) => (
          <NoteBlock key={block.id || i} block={block} />
        ))}
      </div>
    </div>
  );
}
