import { useEffect } from 'react';

interface FocusModeProps {
  mode: 'off' | 'sentence' | 'paragraph';
}

export function FocusMode({ mode }: FocusModeProps) {
  useEffect(() => {
    if (mode === 'off') return;

    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const selector = mode === 'sentence' ? 'span, li, td' : 'p, li, blockquote, pre, div';

      document.querySelectorAll('.focus-highlight').forEach((el) => {
        el.classList.remove('focus-highlight');
      });

      const match = target.closest(selector);
      if (match) {
        match.classList.add('focus-highlight');
      }
    };

    document.addEventListener('mouseover', handler);
    return () => document.removeEventListener('mouseover', handler);
  }, [mode]);

  return null;
}
