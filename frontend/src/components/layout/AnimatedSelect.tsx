import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface AnimatedSelectOption<T extends string> {
  value: T;
  label: string;
}

interface AnimatedSelectProps<T extends string> {
  id?: string;
  value: T;
  onChange: (next: T) => void;
  options: AnimatedSelectOption<T>[];
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  placement?: "down" | "up";
}

export function AnimatedSelect<T extends string>({
  id,
  value,
  onChange,
  options,
  ariaLabel,
  className = "min-w-44",
  buttonClassName = "",
  menuClassName = "",
  placement = "down",
}: AnimatedSelectProps<T>) {
  const generatedId = useId();
  const buttonId = id || generatedId;
  const listboxId = `${buttonId}-listbox`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const activeOptionRef = useRef<HTMLButtonElement | null>(null);

  const selected = useMemo(
    () => options.find((option) => option.value === value) || options[0],
    [options, value],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    requestAnimationFrame(() => activeOptionRef.current?.focus());
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const menuPositionClass =
    placement === "up" ? "bottom-full mb-2" : "top-full mt-2";

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((next) => !next)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-input)] px-3 py-2 text-left text-sm text-[var(--color-text)] shadow-sm transition-[border-color,background-color,box-shadow] duration-200 ease-[var(--motion-ease)] hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${buttonClassName}`}
      >
        <span className="truncate">{selected?.label || value}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 transition-transform duration-200 ease-[var(--motion-ease)] ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={ariaLabel ? undefined : buttonId}
          data-placement={placement}
          className={`menu-pop absolute right-0 ${menuPositionClass} z-50 max-h-72 min-w-full overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-elevated)] p-1 shadow-xl ${menuClassName}`}
        >
          {options.map((option) => {
            const selectedOption = option.value === value;
            return (
              <button
                key={option.value}
                ref={selectedOption ? activeOptionRef : undefined}
                type="button"
                role="option"
                aria-selected={selectedOption}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-200 ease-[var(--motion-ease)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] ${
                  selectedOption
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-text)]"
                }`}
              >
                <span className="truncate">{option.label}</span>
                {selectedOption && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
