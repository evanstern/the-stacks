import {
  activeActorFor,
  type SessionProjections,
  type TableMode,
} from "@the-stacks/session-model";

/** What the human DM's Table mode panel offers (spec 060). Pure; no I/O. */
export interface TableModeView {
  mode: "free" | "turn";
  encounterActive: boolean;
  /** End encounter is offered: an encounter is active. */
  canEnd: boolean;
  /** Switch to free mode is offered: the table is in turn mode. */
  canFree: boolean;
  /** Free mode with an encounter: the turn mode that resumes it. Else null. */
  turnAfter: TableMode | null;
}

export function tableModeView(p: SessionProjections): TableModeView {
  const mode = p.tableMode.mode;
  const enc = p.encounter;
  return {
    mode,
    encounterActive: enc !== null,
    canEnd: enc !== null,
    canFree: mode === "turn",
    turnAfter:
      mode === "free" && enc !== null
        ? { mode: "turn", ...activeActorFor(p, enc.activeCombatantId) }
        : null,
  };
}
