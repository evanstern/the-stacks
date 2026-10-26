import type { TranscriptEntry } from "@the-stacks/session-model";
import {
  CAPS,
  capEntries,
  joinSections,
  section,
  transcriptEntries,
} from "./common.js";

export const PROMPT_VERSION = "dm.chronicle-v1";

const SYSTEM = [
  "You keep the journal of a tabletop role-playing session. You write short factual entries about what happened, from the transcript you are given. You never state a dice total and never invent events.",
  "Write one journal line at every scene change. Name each new person and place once. Put facts the party has not learned in a dm entry. Write at most three entries.",
  "Reply with ONE JSON object and nothing else:",
  '{"entries":[{"title":str (200 characters at most),"body":str (1200 characters at most),"sourceActionIds":[action ids from the transcript],"visibility":"public"|"dm"}]}',
].join("\n\n");

export interface ChroniclePromptInput {
  transcript: readonly TranscriptEntry[];
  goal: string;
  trackerNames: readonly string[];
}

export function buildChroniclePrompt(input: ChroniclePromptInput): {
  system: string;
  user: string;
} {
  const user = joinSections([
    section("Scene goal", [input.goal], 300, "end"),
    section(
      "Trackers (names only)",
      capEntries(input.trackerNames, 200, "end"),
      200,
      "end",
    ),
    section(
      "Transcript to chronicle",
      transcriptEntries(input.transcript),
      CAPS.transcript * 2,
      "start",
    ),
  ]);
  return { system: SYSTEM, user };
}
