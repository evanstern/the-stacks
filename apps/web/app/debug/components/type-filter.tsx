import { useId, useState } from "react";

/**
 * An ARIA 1.2 combobox autocomplete over a list of values. The list renders in
 * flow under the input: no portal, no overlay. Chosen values show as chips.
 */
export function TypeFilter({
  label,
  options,
  selected,
  onChange,
  defaultOpen = false,
}: {
  label: string;
  options: readonly string[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  defaultOpen?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const [active, setActive] = useState(0);
  const matches = options.filter(
    (o) =>
      !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase()),
  );
  const add = (value: string) => {
    onChange([...selected, value]);
    setQuery("");
    setActive(0);
  };
  return (
    <div className="relative flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1">
        {selected.map((s) => (
          <button
            key={s}
            type="button"
            aria-label={`Remove ${s}`}
            onClick={() => onChange(selected.filter((x) => x !== s))}
            className="rounded-full border border-border bg-muted px-2 text-xs"
          >
            {s} ×
          </button>
        ))}
        <input
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={
            open && matches[active] ? `${id}-opt-${active}` : undefined
          }
          placeholder={label}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) =>
                Math.min(a + 1, Math.max(matches.length - 1, 0)),
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              add(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className="min-w-24 flex-1 rounded border border-border bg-background px-2 py-0.5 text-xs"
        />
      </div>
      <div
        id={listId}
        role="listbox"
        aria-label={`${label} options`}
        hidden={!open}
        className="absolute top-full z-20 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-popover text-xs shadow"
      >
        {matches.map((m, i) => (
          <div
            key={m}
            id={`${id}-opt-${i}`}
            role="option"
            tabIndex={-1}
            aria-selected={i === active}
            onMouseDown={(e) => {
              e.preventDefault();
              add(m);
            }}
            className={`cursor-pointer px-2 py-1 ${i === active ? "bg-accent" : ""}`}
          >
            {m}
          </div>
        ))}
        {matches.length === 0 && (
          <div role="presentation" className="px-2 py-1 text-muted-foreground">
            No matches
          </div>
        )}
      </div>
    </div>
  );
}
