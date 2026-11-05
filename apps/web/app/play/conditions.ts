/** "none" or "prone, poisoned": the one wording for conditions on every table surface. */
export function conditionText(
  conditions: readonly { condition: string }[] | undefined | null,
): string {
  if (!conditions || conditions.length === 0) return "none";
  return conditions.map((c) => c.condition).join(", ");
}
