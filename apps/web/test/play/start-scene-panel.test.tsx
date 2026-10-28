import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StartSceneForm } from "~/play/components/start-scene-panel";
import type { TableSource } from "~/play/source";
import type { SeedSummary } from "~/play/start-scene";
import { TableView } from "~/play/table-view";

const yes = () => true;
const base = {
  floor: yes,
  changeScene: yes,
  sendTalk: yes,
  declareAction: yes,
  comment: yes,
  commit: yes,
  withdraw: yes,
  approve: yes,
  reject: yes,
};

function source(
  over: Partial<TableSource> = {},
  withStart = true,
): TableSource {
  return {
    kind: "live",
    viewer: { role: "player", userId: "op" },
    actor: "op",
    events: [],
    status: "open",
    caughtUp: true,
    notice: null,
    proposals: [],
    presence: [],
    role: "operator",
    commands: withStart
      ? { ...base, startScene: async () => ({ ok: true as const }) }
      : base,
    ...over,
  };
}

const html = (s: TableSource) => renderToStaticMarkup(<TableView source={s} />);

test("the operator on a live caught-up table with no scene sees Start scene", () => {
  expect(html(source())).toContain("Start scene");
});

test("a player does not see Start scene", () => {
  expect(html(source({ role: "player" }))).not.toContain("Start scene");
});

test("a fixture table does not see Start scene", () => {
  expect(html(source({ kind: "fixture" }))).not.toContain("Start scene");
  expect(html(source({}, false))).not.toContain("Start scene");
});

test("before replay catches up there is no Start scene", () => {
  expect(html(source({ caughtUp: false }))).not.toContain("Start scene");
});

const seeds: SeedSummary[] = [
  {
    seedId: "greyhollow-duo",
    title: "Greyhollow duo",
    humans: [
      { characterId: "tamsin", name: "Tamsin Vale" },
      { characterId: "kestrel", name: "Kestrel" },
    ],
    companions: [{ characterId: "odo", name: "Brother Odo" }],
  },
  {
    seedId: "greyhollow-ford",
    title: "Greyhollow ford",
    humans: [{ characterId: "tamsin", name: "Tamsin Vale" }],
    companions: [],
  },
];
const present = [
  { userId: "u1", displayName: "Ada" },
  { userId: "u2", displayName: "Bram" },
];
const noop = () => {};
function form(over: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <StartSceneForm
      seeds={seeds}
      seedId="greyhollow-duo"
      seats={{}}
      present={present}
      issues={[]}
      error={null}
      pending={false}
      onSeed={noop}
      onSeat={noop}
      onStart={noop}
      {...over}
    />,
  );
}

test("the form lists seeds, a select per human seat, and the AI companions", () => {
  const out = form();
  expect(out).toContain("Greyhollow duo");
  expect(out).toContain("Greyhollow ford");
  expect(out).toContain("Tamsin Vale");
  expect(out).toContain("Kestrel");
  expect(out).toContain("Ada");
  expect(out).toContain("Bram");
  expect(out).toContain("Brother Odo");
});

test("Start is disabled while a seat is empty", () => {
  expect(form({ seats: { tamsin: "u1" } })).toMatch(
    /<button[^>]*\sdisabled=""[^>]*>Start</,
  );
});

test("Start is disabled while one user holds both seats", () => {
  expect(form({ seats: { tamsin: "u1", kestrel: "u1" } })).toMatch(
    /<button[^>]*\sdisabled=""[^>]*>Start</,
  );
});

test("Start is enabled for a full distinct map", () => {
  expect(form({ seats: { tamsin: "u1", kestrel: "u2" } })).not.toMatch(
    /<button[^>]*\sdisabled=""[^>]*>Start</,
  );
});

test("a server seat issue shows beside that seat", () => {
  const out = form({
    seats: { tamsin: "u1", kestrel: "u2" },
    issues: [
      { path: "seats.kestrel", message: "Not a human character in this seed." },
    ],
  });
  expect(out).toContain("Not a human character in this seed.");
  expect(out).toContain('role="alert"');
});

test("a form-level error shows under the form", () => {
  expect(form({ error: "Scene already running." })).toContain(
    "Scene already running.",
  );
});
