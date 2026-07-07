/**
 * The SHIPPED plugin lineup (008 FR-028) — the one place the in-tree plugin
 * list is wired (research R13's in-tree packaging decision). Registration
 * ORDER is load-bearing: specific plugins before fallbacks, because the
 * registry breaks confidence ties by order (registry.ts).
 *
 * US4 appends the markdown and generic-html fallbacks here; US5's demo
 * plugin is test-only and deliberately NOT in this list.
 */
import { ddbSavedHtmlPlugin } from "@stacks/ingestion-plugins";

import type { PluginRegistry } from "./registry";
import { createRegistry } from "./registry";

export function createShippedRegistry(): PluginRegistry {
  return createRegistry([ddbSavedHtmlPlugin]);
}
