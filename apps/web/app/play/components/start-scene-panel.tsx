import { useEffect, useState } from "react";
import { Panel } from "~/components/panel";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import type { PresenceEntry } from "../../ws/types.ts";
import {
  fetchSeeds,
  type Issue,
  issuesBySeat,
  type SeatMap,
  type SeedSummary,
  type StartBody,
  type StartResult,
  seatMapIssues,
  startBody,
} from "../start-scene.ts";

export const START_SCENE_PANEL_ID = "start-scene-panel";

const SELECT =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm";

export interface StartSceneFormProps {
  seeds: readonly SeedSummary[];
  seedId: string;
  seats: SeatMap;
  present: readonly PresenceEntry[];
  dmUserId: string | null;
  issues: readonly Issue[];
  error: string | null;
  pending: boolean;
  onSeed: (seedId: string) => void;
  onSeat: (characterId: string, userId: string) => void;
  onStart: () => void;
}

/** The slide-out's body. Controlled and stateless so each mode renders from props. */
export function StartSceneForm({
  seeds,
  seedId,
  seats,
  present,
  dmUserId,
  issues,
  error,
  pending,
  onSeed,
  onSeat,
  onStart,
}: StartSceneFormProps) {
  const seed = seeds.find((s) => s.seedId === seedId) ?? null;
  const { bySeat, form } = issuesBySeat(issues);
  const ready =
    seed !== null && seatMapIssues(seed.humans, seats, dmUserId).length === 0;
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !pending) onStart();
      }}
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="start-seed">Seed</Label>
        <select
          id="start-seed"
          className={SELECT}
          value={seedId}
          onChange={(event) => onSeed(event.target.value)}
        >
          {seeds.map((s) => (
            <option key={s.seedId} value={s.seedId}>
              {s.title} ({s.seedId})
            </option>
          ))}
        </select>
      </div>
      {seed?.humans.map((human) => (
        <div key={human.characterId} className="flex flex-col gap-2">
          <Label htmlFor={`start-seat-${human.characterId}`}>
            {human.name}
          </Label>
          <select
            id={`start-seat-${human.characterId}`}
            className={SELECT}
            value={seats[human.characterId] ?? ""}
            onChange={(event) => onSeat(human.characterId, event.target.value)}
          >
            <option value="">Choose a player</option>
            {present.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {entry.displayName}
              </option>
            ))}
          </select>
          {bySeat[human.characterId]?.map((message) => (
            <p key={message} role="alert" className="text-sm">
              {message}
            </p>
          ))}
        </div>
      ))}
      {seed && seed.companions.length > 0 && (
        <p className="text-sm text-muted-foreground">
          AI companions: {seed.companions.map((c) => c.name).join(", ")}.
        </p>
      )}
      {form.map((message) => (
        <p key={message} role="alert" className="text-sm">
          {message}
        </p>
      ))}
      {error && (
        <p role="alert" className="text-sm">
          {error}
        </p>
      )}
      <Button type="submit" disabled={!ready || pending}>
        Start
      </Button>
    </form>
  );
}

/** Run one start request and map the result to the panel's inline state. */
export async function runStart(
  startScene: (body: StartBody) => Promise<StartResult>,
  seedId: string,
  seats: SeatMap,
): Promise<
  { ok: true } | { ok: false; issues: Issue[]; error: string | null }
> {
  let result: StartResult;
  try {
    result = await startScene(startBody(seedId, seats));
  } catch {
    return { ok: false, issues: [], error: "Could not start the scene." };
  }
  if (result.ok) return { ok: true };
  if (result.status === 400 && result.issues.length > 0) {
    return { ok: false, issues: result.issues, error: null };
  }
  return { ok: false, issues: [], error: result.message };
}

/** The operator's Start scene slide-out. Loads seeds on open; closes on a 202. */
export function StartScenePanel({
  open,
  onOpenChange,
  present,
  startScene,
  dmUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  present: readonly PresenceEntry[];
  startScene: (body: StartBody) => Promise<StartResult>;
  dmUserId: string | null;
}) {
  const [seeds, setSeeds] = useState<SeedSummary[]>([]);
  const [seedId, setSeedId] = useState("");
  const [seats, setSeats] = useState<SeatMap>({});
  const [issues, setIssues] = useState<Issue[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setError(null);
    fetchSeeds().then(
      (loaded) => {
        if (!live) return;
        setSeeds(loaded);
        setSeedId((was) =>
          loaded.some((s) => s.seedId === was)
            ? was
            : (loaded[0]?.seedId ?? ""),
        );
      },
      () => {
        if (live) setError("Could not load seeds.");
      },
    );
    return () => {
      live = false;
    };
  }, [open]);

  async function start() {
    setPending(true);
    setIssues([]);
    setError(null);
    const outcome = await runStart(startScene, seedId, seats);
    setPending(false);
    if (outcome.ok) {
      onOpenChange(false);
    } else {
      setIssues(outcome.issues);
      setError(outcome.error);
    }
  }

  return (
    <Panel
      open={open}
      onOpenChange={onOpenChange}
      title="Start scene"
      description="Choose a seed and a player for each human seat."
      id={START_SCENE_PANEL_ID}
    >
      <StartSceneForm
        seeds={seeds}
        seedId={seedId}
        seats={seats}
        present={present}
        dmUserId={dmUserId}
        issues={issues}
        error={error}
        pending={pending}
        onSeed={(id) => {
          setSeedId(id);
          setSeats({});
          setIssues([]);
        }}
        onSeat={(characterId, userId) => {
          setSeats((was) => ({ ...was, [characterId]: userId }));
          setIssues([]);
        }}
        onStart={start}
      />
    </Panel>
  );
}
