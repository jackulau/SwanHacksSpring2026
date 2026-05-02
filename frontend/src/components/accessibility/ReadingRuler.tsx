import { useEffect, useState } from 'react';

interface ReadingRulerProps {
  enabled: boolean;
}

export function ReadingRuler({ enabled }: ReadingRulerProps) {
  const [y, setY] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => setY(e.clientY);
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      className="fixed left-0 right-0 h-px bg-indigo-500/60 pointer-events-none z-50"
      style={{ top: y }}
    >
      <div className="absolute left-0 right-0 h-8 -translate-y-4 bg-indigo-500/5 pointer-events-none" />
    </div>
  );
}
