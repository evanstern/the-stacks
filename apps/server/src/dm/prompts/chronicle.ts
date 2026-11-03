import type { TranscriptEntry } from "@the-stacks/session-model";
import { type ActorSnapshot, snapshotSection } from "../snapshot/index.js";
import {
  CAPS,
  capEntries,
  joinSections,
  type RosterEntry,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.chronicle-v4";

const SYSTEM = [
  "You keep the journal of a tabletop role-playing session. You write short factual entries about what happened, from the transcript you are given. You never state a dice total and never invent events.",
  "Write one journal line at every scene change. Name each new person and place once. Put facts the party has not learned in a dm entry. Write at most three entries. Write that someone left only when the transcript tells it. Someone missing from the state may still be on the scene.",
  "Reply with ONE JSON object and nothing else:",
  '{"entries":[{"title":str (200 characters at most),"body":str (1200 characters at most),"sourceActionIds":[action ids from the transcript],"visibility":"public"|"dm"}]}',
].join("\n\n");

export interface ChroniclePromptInput {
  /** The actor snapshot at the job's throughSeq. */
  snapshot: ActorSnapshot;
  transcript: readonly TranscriptEntry[];
  goal: string;
  roster: readonly RosterEntry[];
  trackerNames: readonly string[];
}

export function buildChroniclePrompt(input: ChroniclePromptInput): {
  system: string;
  user: string;
} {
  const user = joinSections([
    snapshotSection(
      "State at the end of this transcript",
      // Spec 078: an offstage actor reads "gone" in the fiction view; the
      // transcript alone tells who is on the scene.
      {
        ...input.snapshot,
        actors: input.snapshot.actors.filter((a) => a.presence !== "absent"),
      },
      { view: "fiction", cap: CAPS.snapshotFiction },
    ),
    section("Scene goal", [input.goal], 300, "end"),
    section(
      "Trackers (names only)",
      capEntries(input.trackerNames, 200, "end"),
      200,
      "end",
    ),
    section(
      "Transcript to chronicle",
      transcriptEntries(input.transcript, input.roster),
      CAPS.transcript * 2,
      "start",
    ),
  ]);
  return { system: SYSTEM, user };
}
