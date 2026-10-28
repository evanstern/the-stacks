import { project } from "@the-stacks/session-model";
import { dmApprovals } from "@the-stacks/session-model/fixtures";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import {
  applyInput,
  draftFor,
  initialDraft,
  ScenePanel,
} from "~/play/components/scene-panel";
import { selectPendingProposals } from "~/play/proposals";
import {
  type SceneChangeView,
  type SceneSeedView,
  sceneChangeView,
} from "~/play/scene-seeds";

const dm = dmApprovals.viewers.dm;
const events = dmApprovals.events;
const projected = project(events, dm);
const pendingIds = new Set(
  selectPendingProposals(events, dm).map((p) => p.proposalId),
);

const withPending = sceneChangeView(projected, pendingIds);
const withEarlier = sceneChangeView(projected, new Set());

const yes = () => true;
const html = (view: SceneChangeView) =>
  renderToStaticMarkup(<ScenePanel view={view} onApply={yes} />);

function seedOf(view: SceneChangeView, key: string): SceneSeedView {
  const all = [...view.pending, ...view.earlier];
  const seed = all.find((s) => s.key === key);
  if (!seed) throw new Error(`seed ${key} missing`);
  return seed;
}

test("the panel is seeded from the pending suggestion P3", () => {
  const out = html(withPending);
  expect(out).toMatch(/<label[^>]*for="scene-id"[^>]*>Scene id/);
  expect(out).toMatch(/<input[^>]*id="scene-id"[^>]*readOnly=""/);
  expect(out).toContain('value="vault-interior"');
  expect(out).toContain('value="Inside the vault"');
  expect(out).toContain("Shelves of dusty crates line a low stone room.");
  expect(out).toContain('value="Undercroft"');
  expect(out).toContain(">The party steps through the open door</textarea>");
  expect(out).toMatch(/<label[^>]*for="scene-title"[^>]*>Scene title/);
  expect(out).toMatch(/<label[^>]*for="scene-summary"[^>]*>Scene summary/);
  expect(out).toMatch(/<label[^>]*for="scene-location"[^>]*>Scene location/);
  expect(out).toMatch(
    /<label[^>]*for="scene-reason"[^>]*>Reason for the change/,
  );
  expect(out).toContain(">Apply<");
});

test("seed buttons sit under Suggestions and Earlier suggestions with tags", () => {
  const pending = html(withPending);
  expect(pending).toContain("Suggestions");
  expect(pending).not.toContain("Earlier suggestions");
  expect(pending).toContain("Use: Move the party into the vault");
  expect(pending).toContain("Use: Current scene");
  expect(pending).toContain("Suggestion<");
  const earlier = html(withEarlier);
  expect(earlier).toContain("Earlier suggestions");
  expect(earlier).toContain("Use: Move the party into the vault");
  const ask: SceneChangeView = {
    ...withPending,
    pending: withPending.pending.map((s) => ({ ...s, policy: "ask" as const })),
  };
  expect(html(ask)).toContain("Proposal<");
});

test("Clear the scene shows only when a scene is set", () => {
  expect(html(withPending)).toContain("Clear the scene");
  const none: SceneChangeView = { ...withPending, current: null };
  const out = html(none);
  expect(out).not.toContain("Clear the scene");
  expect(out).not.toContain("Use: Current scene");
});

test("turn mode shows its line", () => {
  expect(html(withPending)).not.toContain("The table stays in turn mode.");
  expect(html({ ...withPending, turnMode: true })).toContain(
    "The table stays in turn mode.",
  );
});

test("empty shows the D-7 line and no Apply", () => {
  const out = html({
    current: null,
    pending: [],
    earlier: [],
    turnMode: false,
    empty: true,
  });
  expect(out).toContain(
    "No scene to change yet. Start a scene, or wait for the AI DM&#x27;s suggestion.",
  );
  expect(out).not.toContain("Apply");
});

test("no element is a modal dialog", () => {
  for (const view of [withPending, withEarlier]) {
    const out = html(view);
    expect(out).not.toContain('role="dialog"');
    expect(out).not.toContain("aria-modal");
    expect(out).not.toContain("<dialog");
  }
});

test("initialDraft takes the oldest pending seed, else the current scene", () => {
  expect(initialDraft(withPending).seedKey).toBe("prop-3");
  expect(initialDraft(withEarlier).seedKey).toBe("current");
  expect(initialDraft(withPending).title).toBe("Inside the vault");
});

test("applyInput keeps the seed's sceneId and closes only a pending seed", () => {
  const pending = seedOf(withPending, "prop-3");
  const draft = { ...draftFor(pending), title: "A very different title" };
  const input = applyInput(draft, pending);
  expect(input.after?.sceneId).toBe("vault-interior");
  expect(input.after?.title).toBe("A very different title");
  expect(input.closeProposalId).toBe("prop-3");
  expect(input.reason).toBe("The party steps through the open door");

  const earlier = seedOf(withEarlier, "prop-3");
  const out = applyInput(draftFor(earlier), earlier);
  expect(out.after?.sceneId).toBe("vault-interior");
  expect(out.closeProposalId).toBeNull();

  const current = withPending.current;
  if (!current) throw new Error("current missing");
  const edit = applyInput({ ...draftFor(current), location: "  " }, current);
  expect(edit.after?.sceneId).toBe("vault-door");
  expect(edit.after?.location).toBeNull();
  expect(edit.closeProposalId).toBeNull();
});

test("applyInput sends after: null when Clear the scene is checked", () => {
  const pending = seedOf(withPending, "prop-3");
  const input = applyInput({ ...draftFor(pending), clear: true }, pending);
  expect(input.after).toBeNull();
  expect(input.closeProposalId).toBe("prop-3");
});
