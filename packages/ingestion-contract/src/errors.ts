/**
 * Plugin failure vocabulary (contracts/plugin-contract.md). Deliberately NOT
 * @stacks/core's DomainError: plugins don't import core (FR-014 — the contract
 * package is their ONLY internal dependency), so they need their own error
 * type. The pipeline core maps categories onto DomainError classes at the
 * seam; anything else a plugin throws is internal_fault — a plugin bug.
 */

export const PLUGIN_FAILURE_CATEGORIES = [
  // detect was wrong / content isn't what it claimed to be
  "unrecognized",
  // recognized format, broken content (truncated, invalid markup)
  "malformed",
  // recognized family, variant we deliberately don't handle
  "unsupported_variant",
] as const;

export type PluginFailureCategory = (typeof PLUGIN_FAILURE_CATEGORIES)[number];

export class PluginError extends Error {
  readonly category: PluginFailureCategory;

  constructor(category: PluginFailureCategory, message: string) {
    super(message);
    this.name = "PluginError";
    this.category = category;
  }
}
