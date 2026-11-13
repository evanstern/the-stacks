export type Chip = "all" | "ic" | "table" | "rules";

const CHIPS: { id: Chip; label: string }[] = [
  { id: "all", label: "All" },
  { id: "ic", label: "In character" },
  { id: "table", label: "Table talk" },
  { id: "rules", label: "Rules" },
];

/** Four single-select filter buttons (FR-009). */
export function FilterChips({
  value,
  onChange,
}: {
  value: Chip;
  onChange: (chip: Chip) => void;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: spec FR-009 names role="group".
    <div
      role="group"
      aria-label="Filter the stream"
      className="flex flex-wrap gap-2"
    >
      {CHIPS.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={value === c.id}
          onClick={() => onChange(c.id)}
          className={`rounded-full border border-border px-3 py-1 text-sm hover:bg-accent ${
            value === c.id ? "bg-secondary font-medium" : ""
          }`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}
