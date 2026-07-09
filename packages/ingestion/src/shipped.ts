/**
 * The SHIPPED plugin lineup (008 FR-028) — the one place the in-tree plugin
 * list is wired (research R13's in-tree packaging decision). Registration
 * ORDER is load-bearing: specific plugins before fallbacks, because the
 * registry breaks confidence ties by order (registry.ts). ddb-saved-html
 * goes first (it's the only plugin that ever claims text/html above the
 * 0.1 floor); markdown and generic-html are the US4 fallbacks, each the sole
 * claimant of its own media types, so their relative order doesn't matter.
 *
 * US5's demo plugin is test-only and deliberately NOT in this list.
 */
import { ddbSavedHtmlPlugin, genericHtmlPlugin, markdownPlugin } from "@stacks/ingestion-plugins";

import type { PluginRegistry } from "./registry";
import { createRegistry } from "./registry";

export function createShippedRegistry(): PluginRegistry {
  return createRegistry([ddbSavedHtmlPlugin, markdownPlugin, genericHtmlPlugin]);
}
