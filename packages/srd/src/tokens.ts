/** Deterministic token estimate. Standard library only; no model, network, or vendor tokenizer. */
export function estimateTokens(text: string): number {
  let total = 0;
  for (const match of text.matchAll(/[A-Za-z]+|[0-9]+|[^\sA-Za-z0-9]/g)) {
    const part = match[0];
    if (/^[A-Za-z]/.test(part)) total += Math.ceil(part.length / 5);
    else if (/^[0-9]/.test(part)) total += Math.ceil(part.length / 3);
    else total += 1;
  }
  return total;
}
