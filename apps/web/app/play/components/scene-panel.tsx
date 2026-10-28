import { useEffect, useState } from "react";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { SceneChangeView, SceneSeedView } from "../scene-seeds.ts";
import type { SceneInput } from "../source.ts";

export const SCENE_PANEL_ID = "scene-panel";

const BUTTON =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:bg-accent";
const FIELD =
  "w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm disabled:opacity-50";

/** The form's editable state. `seedKey` names the seed the draft started from. */
export interface SceneDraft {
  seedKey: string | null;
  title: string;
  summary: string;
  location: string;
  reason: string;
  clear: boolean;
}

/** A draft that starts from one seed. */
export function draftFor(seed: SceneSeedView): SceneDraft {
  return {
    seedKey: seed.key,
    title: seed.scene?.title ?? "",
    summary: seed.scene?.summary ?? "",
    location: seed.scene?.location ?? "",
    reason: seed.reason,
    clear: seed.clear,
  };
}

function allSeeds(view: SceneChangeView): SceneSeedView[] {
  return [
    ...view.pending,
    ...view.earlier,
    ...(view.current ? [view.current] : []),
  ];
}

/** The oldest pending seed, else the current scene, else a blank draft. */
export function initialDraft(view: SceneChangeView): SceneDraft {
  const seed = view.pending[0] ?? view.current;
  return seed
    ? draftFor(seed)
    : {
        seedKey: null,
        title: "",
        summary: "",
        location: "",
        reason: "",
        clear: false,
      };
}

/**
 * The gate request for a draft. The scene id always comes from the seed; the DM never types
 * it. Only a pending seed is closed (D-3).
 */
export function applyInput(draft: SceneDraft, seed: SceneSeedView): SceneInput {
  return {
    reason: draft.reason.trim(),
    after: draft.clear
      ? null
      : {
          sceneId: seed.scene?.sceneId ?? "",
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          location: draft.location.trim() === "" ? null : draft.location.trim(),
        },
    closeProposalId: seed.origin === "pending" ? seed.proposalId : null,
  };
}

function SeedButton({
  seed,
  active,
  onPick,
}: {
  seed: SceneSeedView;
  active: boolean;
  onPick: (seed: SceneSeedView) => void;
}) {
  const tag =
    seed.policy === "suggest"
      ? "Suggestion"
      : seed.policy === "ask"
        ? "Proposal"
        : null;
  return (
    <li>
      <button
        type="button"
        aria-pressed={active}
        onClick={() => onPick(seed)}
        className={`${BUTTON} flex w-full items-center gap-2 text-left aria-pressed:bg-accent`}
      >
        <span className="min-w-0 flex-1">Use: {seed.label}</span>
        {tag && (
          <span className="rounded-sm border border-border bg-muted px-1.5 py-0.5 text-xs">
            {tag}
          </span>
        )}
      </button>
    </li>
  );
}

function SeedList({
  heading,
  seeds,
  seedKey,
  onPick,
}: {
  heading: string;
  seeds: SceneSeedView[];
  seedKey: string | null;
  onPick: (seed: SceneSeedView) => void;
}) {
  if (seeds.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{heading}</h3>
      <ul className="flex flex-col gap-2">
        {seeds.map((s) => (
          <SeedButton
            key={s.key}
            seed={s}
            active={s.key === seedKey}
            onPick={onPick}
          />
        ))}
      </ul>
    </section>
  );
}

/** The human DM's Change scene body. Renders inside the shared slide-out `Panel`. */
export function ScenePanel({
  view,
  onApply,
}: {
  view: SceneChangeView;
  onApply: (input: SceneInput) => boolean;
}) {
  const [draft, setDraft] = useState<SceneDraft>(() => initialDraft(view));
  const seeds = allSeeds(view);
  const seed = seeds.find((s) => s.key === draft.seedKey) ?? null;

  // A closed or vanished seed drops the draft back to the next seed.
  useEffect(() => {
    if (draft.seedKey !== null && !seeds.some((s) => s.key === draft.seedKey)) {
      setDraft(initialDraft(view));
    } else if (draft.seedKey === null && seeds.length > 0) {
      setDraft(initialDraft(view));
    }
  }, [view, seeds, draft.seedKey]);

  if (view.empty) {
    return (
      <p className="text-sm text-muted-foreground">
        No scene to change yet. Start a scene, or wait for the AI DM's
        suggestion.
      </p>
    );
  }

  const edit = (patch: Partial<SceneDraft>) =>
    setDraft((was) => ({ ...was, ...patch }));
  const pick = (s: SceneSeedView) => setDraft(draftFor(s));
  const sceneId = seed?.scene?.sceneId ?? "";
  const ready =
    seed !== null &&
    draft.reason.trim() !== "" &&
    (draft.clear || (sceneId !== "" && draft.title.trim() !== ""));

  return (
    <div className="flex flex-col gap-4">
      {view.turnMode && (
        <p className="text-sm text-muted-foreground">
          The table stays in turn mode.
        </p>
      )}
      <SeedList
        heading="Suggestions"
        seeds={view.pending}
        seedKey={draft.seedKey}
        onPick={pick}
      />
      <SeedList
        heading="Earlier suggestions"
        seeds={view.earlier}
        seedKey={draft.seedKey}
        onPick={pick}
      />
      {view.current && (
        <SeedList
          heading="Current scene"
          seeds={[view.current]}
          seedKey={draft.seedKey}
          onPick={pick}
        />
      )}
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready || seed === null) return;
          if (onApply(applyInput(draft, seed))) setDraft(initialDraft(view));
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scene-id">Scene id</Label>
          <Input id="scene-id" type="text" readOnly value={sceneId} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scene-title">Scene title</Label>
          <Input
            id="scene-title"
            type="text"
            disabled={draft.clear}
            value={draft.title}
            onChange={(event) => edit({ title: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scene-summary">Scene summary</Label>
          <textarea
            id="scene-summary"
            rows={4}
            className={FIELD}
            disabled={draft.clear}
            value={draft.summary}
            onChange={(event) => edit({ summary: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scene-location">Scene location</Label>
          <Input
            id="scene-location"
            type="text"
            disabled={draft.clear}
            value={draft.location}
            onChange={(event) => edit({ location: event.target.value })}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="scene-reason">Reason for the change</Label>
          <textarea
            id="scene-reason"
            rows={2}
            className={FIELD}
            value={draft.reason}
            onChange={(event) => edit({ reason: event.target.value })}
          />
        </div>
        {view.current && (
          <div className="flex items-center gap-2">
            <input
              id="scene-clear"
              type="checkbox"
              checked={draft.clear}
              onChange={(event) => edit({ clear: event.target.checked })}
            />
            <Label htmlFor="scene-clear">Clear the scene</Label>
          </div>
        )}
        <button
          type="submit"
          disabled={!ready}
          className="self-start rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
