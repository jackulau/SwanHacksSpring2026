import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Inline markdown renderer — handles `code`, **bold**, *italic*, [link](url),
 * and ~~strike~~. Deliberately tiny; we don't ship a parser. Returns React
 * children that can be dropped inside any block element.
 */
export function renderInlineMarkdown(input: string): ReactNode {
  if (!input) return null;
  const tokens: ReactNode[] = [];
  let buf = "";
  let i = 0;
  let k = 0;
  const flush = () => {
    if (buf) {
      tokens.push(buf);
      buf = "";
    }
  };

  while (i < input.length) {
    const ch = input[i];
    // Inline code: `text`
    if (ch === "`") {
      const close = input.indexOf("`", i + 1);
      if (close > i) {
        flush();
        tokens.push(
          createElement(
            "code",
            {
              key: k++,
              className:
                "px-1 py-0.5 rounded text-[0.85em] font-mono bg-[var(--color-surface-raised)] text-[var(--color-primary-strong)]",
            },
            input.slice(i + 1, close),
          ),
        );
        i = close + 1;
        continue;
      }
    }
    // Bold: **text**
    if (ch === "*" && input[i + 1] === "*") {
      const close = input.indexOf("**", i + 2);
      if (close > i + 1) {
        flush();
        tokens.push(
          createElement(
            "strong",
            { key: k++, className: "text-[var(--color-text)] font-semibold" },
            renderInlineMarkdown(input.slice(i + 2, close)),
          ),
        );
        i = close + 2;
        continue;
      }
    }
    // Italic: *text* (single asterisk, not adjacent to another *)
    if (ch === "*" && input[i + 1] !== "*" && input[i - 1] !== "*") {
      const close = input.indexOf("*", i + 1);
      if (close > i && input[close + 1] !== "*") {
        flush();
        tokens.push(
          createElement(
            "em",
            { key: k++, className: "italic" },
            renderInlineMarkdown(input.slice(i + 1, close)),
          ),
        );
        i = close + 1;
        continue;
      }
    }
    // Strike: ~~text~~
    if (ch === "~" && input[i + 1] === "~") {
      const close = input.indexOf("~~", i + 2);
      if (close > i + 1) {
        flush();
        tokens.push(
          createElement(
            "del",
            { key: k++, className: "text-[var(--color-text-subtle)]" },
            input.slice(i + 2, close),
          ),
        );
        i = close + 2;
        continue;
      }
    }
    // Link: [label](url)
    if (ch === "[") {
      const labelEnd = input.indexOf("]", i + 1);
      if (labelEnd > i && input[labelEnd + 1] === "(") {
        const urlEnd = input.indexOf(")", labelEnd + 2);
        if (urlEnd > labelEnd + 1) {
          flush();
          const label = input.slice(i + 1, labelEnd);
          const url = input.slice(labelEnd + 2, urlEnd);
          tokens.push(
            createElement(
              "a",
              {
                key: k++,
                href: url,
                target: "_blank",
                rel: "noopener noreferrer",
                className:
                  "text-[var(--color-primary-strong)] underline underline-offset-2 hover:opacity-80",
              },
              label,
            ),
          );
          i = urlEnd + 1;
          continue;
        }
      }
    }
    buf += ch;
    i++;
  }
  flush();
  return createElement(Fragment, null, ...tokens);
}

/**
 * Convenience: render a single markdown block as a paragraph. Used for
 * places that want one-line markdown without our heavier block renderer.
 */
export function renderMarkdownBlock(input: string): ReactNode {
  return createElement(
    "p",
    { className: "leading-7 text-[var(--color-text-muted)]" },
    renderInlineMarkdown(input),
  );
}
