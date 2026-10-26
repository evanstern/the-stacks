import type { PendingProposalView } from "../proposals.ts";

/**
 * Original example proposals for fixture mode, shown to the DM viewer only. Replaced by
 * TASK-0045's real proposal events in Phase 6 (contracts/proposal-seam.md).
 */
export const fixtureProposals: Readonly<
  Record<string, readonly PendingProposalView[]>
> = {
  "free-mode-action": [
    {
      proposalId: "prop-vault-narration",
      kind: "narration",
      summary: "Narrate the vault door swinging open",
      proposer: "ai:dm",
      proposerLabel: "DM",
      actionId: "act-lockpick",
      details: [
        { label: "Text", value: "The old lock gives with a dry click." },
        { label: "Visibility", value: "Public" },
      ],
      createdSeq: 9,
      ts: "2026-10-26T18:00:09.000Z",
    },
    {
      proposalId: "prop-vault-journal",
      kind: "journal.entry",
      summary: "Record the vault in the journal",
      proposer: "ai:companion:bram",
      proposerLabel: "Bram",
      actionId: null,
      details: [
        { label: "Title", value: "The undercroft vault" },
        { label: "Visibility", value: "DM only" },
      ],
      createdSeq: 10,
      ts: "2026-10-26T18:00:10.000Z",
    },
  ],
  "turn-mode-combat": [
    {
      proposalId: "prop-goblin-damage",
      kind: "damage.apply",
      summary: "Apply 5 slashing damage to the goblin",
      proposer: "ai:dm",
      proposerLabel: "DM",
      actionId: "act-ana-attack",
      details: [
        { label: "Target", value: "Goblin" },
        { label: "Amount", value: "5 slashing" },
      ],
      createdSeq: 20,
      ts: "2026-10-26T18:00:20.000Z",
    },
    {
      proposalId: "prop-bram-move",
      kind: "narration",
      summary: "Narrate Bram circling behind the goblin",
      proposer: "ai:companion:bram",
      proposerLabel: "Bram",
      actionId: "act-bram-attack",
      details: [
        { label: "Text", value: "Bram slips around the goblin's flank." },
      ],
      createdSeq: 21,
      ts: "2026-10-26T18:00:21.000Z",
    },
  ],
};
