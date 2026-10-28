/** Pure helpers and fetch wrappers for the operator's Start scene slide-out. */

export interface SeedCharacter {
  characterId: string;
  name: string;
}

/** One entry of `GET /dm/seeds` (specs/054-two-player-alpha-kit/contracts/dm-seeds.md). */
export interface SeedSummary {
  seedId: string;
  title: string;
  humans: SeedCharacter[];
  companions: SeedCharacter[];
}

export interface Issue {
  path: string;
  message: string;
}

export interface StartBody {
  seedId: string;
  seats: Record<string, string>;
}

export type StartResult =
  | { ok: true }
  | { ok: false; status: number; issues: Issue[]; message: string };

/** A seat map, character id to user id; an empty string is an empty choice. */
export type SeatMap = Record<string, string>;

/** One issue per empty seat, and one per later seat whose user already holds an earlier seat. */
export function seatMapIssues(
  humans: readonly SeedCharacter[],
  seats: SeatMap,
): Issue[] {
  const issues: Issue[] = [];
  const held = new Set<string>();
  for (const human of humans) {
    const userId = seats[human.characterId];
    if (!userId) {
      issues.push({
        path: `seats.${human.characterId}`,
        message: "A human seat needs a user.",
      });
    } else if (held.has(userId)) {
      issues.push({
        path: `seats.${human.characterId}`,
        message: "A user can hold only one seat.",
      });
    } else {
      held.add(userId);
    }
  }
  return issues;
}

/** The request body: empty seats are dropped. */
export function startBody(seedId: string, seats: SeatMap): StartBody {
  const kept: SeatMap = {};
  for (const [characterId, userId] of Object.entries(seats)) {
    if (userId) kept[characterId] = userId;
  }
  return { seedId, seats: kept };
}

/** Group server issues: `seats.<id>` paths go to that seat, everything else to the form. */
export function issuesBySeat(issues: readonly Issue[]): {
  bySeat: Record<string, string[]>;
  form: string[];
} {
  const bySeat: Record<string, string[]> = {};
  const form: string[] = [];
  for (const issue of issues) {
    if (issue.path.startsWith("seats.")) {
      const id = issue.path.slice("seats.".length);
      if (!bySeat[id]) bySeat[id] = [];
      bySeat[id].push(issue.message);
    } else {
      form.push(issue.message);
    }
  }
  return { bySeat, form };
}

/** GET /dm/seeds (operator only). */
export async function fetchSeeds(): Promise<SeedSummary[]> {
  const res = await fetch("/dm/seeds", { credentials: "same-origin" });
  if (!res.ok) throw new Error("Could not load seeds.");
  return ((await res.json()) as { seeds: SeedSummary[] }).seeds;
}

/** POST /dm/sessions/:sessionId/start. 202 is success; any refusal carries its issues. */
export async function postStart(
  sessionId: string,
  body: StartBody,
): Promise<StartResult> {
  const res = await fetch(
    `/dm/sessions/${encodeURIComponent(sessionId)}/start`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (res.ok) return { ok: true };
  let issues: Issue[] = [];
  let message = "Could not start the scene.";
  try {
    const parsed = (await res.json()) as {
      error?: { message?: string; issues?: Issue[] };
    };
    issues = parsed.error?.issues ?? [];
    message = parsed.error?.message ?? message;
  } catch {
    // Non-JSON body: the status carries the meaning.
  }
  return { ok: false, status: res.status, issues, message };
}
