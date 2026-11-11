/** Display text for the debug page. Pure. */

export const TURN_NODES = [
  "assemble",
  "director",
  "interpret",
  "adjudicate",
  "resolve",
  "narrate-check",
  "failure",
] as const;
export type TurnNode = (typeof TURN_NODES)[number];

const NODE_NAMES: Record<TurnNode, string> = {
  assemble: "Assemble",
  director: "Director",
  interpret: "Interpret",
  adjudicate: "Adjudicate",
  resolve: "Resolve",
  "narrate-check": "Narrate and check",
  failure: "Failure",
};

/** A turn node's display name; an unknown node stays raw. */
export function nodeName(node: string): string {
  return (NODE_NAMES as Record<string, string>)[node] ?? node;
}

/** `4 s`, `2 m 05 s`, `1 h 02 m`. Negative or non-finite input reads `0 s`. */
export function ageText(ms: number): string {
  const total = Number.isFinite(ms) && ms > 0 ? Math.floor(ms / 1000) : 0;
  if (total < 60) return `${total} s`;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (total < 3600) return `${Math.floor(total / 60)} m ${pad(total % 60)} s`;
  return `${Math.floor(total / 3600)} h ${pad(Math.floor((total % 3600) / 60))} m`;
}

/** `unpriced` for null, else `$0.0123` (four decimals). */
export function costText(usd: number | null): string {
  return usd === null ? "unpriced" : `$${usd.toFixed(4)}`;
}
