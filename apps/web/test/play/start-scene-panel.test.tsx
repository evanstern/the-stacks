import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { StartSceneForm } from "~/play/components/start-scene-panel";
import type { TableSource } from "~/play/source";
import { type SeedSummary, seatMapIssues, startBody } from "~/play/start-scene";
import { TableView } from "~/play/table-view";

const yes = () => true;
const base = {
  floor: yes,
  endEncounter: yes,
  setTableMode: yes,
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
    sceneStart: "none",
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
const trioSeed: SeedSummary = {
  seedId: "greyhollow-ford-trio",
  title: "Greyhollow Ford (three players)",
  humans: [
    { characterId: "tamsin", name: "Tamsin Vale" },
    { characterId: "odo", name: "Brother Odo" },
    { characterId: "kestrel", name: "Kestrel" },
  ],
  companions: [],
};
const present = [
  { userId: "u1", displayName: "Ada" },
  { userId: "u2", displayName: "Bram" },
];
const presentThree = [...present, { userId: "u3", displayName: "Cass" }];
const noop = () => {};
function form(over: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    <StartSceneForm
      dmUserId={null}
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

const trioForm = (seats: Record<string, string>) =>
  form({
    seeds: [...seeds, trioSeed],
    seedId: "greyhollow-ford-trio",
    present: presentThree,
    seats,
  });
const startDisabled = /<button[^>]*\sdisabled=""[^>]*>Start</;

test("the trio form renders three seat selects, each offering all three users, and no companion note", () => {
  const out = trioForm({});
  for (const id of ["tamsin", "odo", "kestrel"]) {
    expect(out).toContain(`id="start-seat-${id}"`);
  }
  for (const name of ["Ada", "Bram", "Cass"]) {
    // One option per seat.
    expect(out.split(`>${name}</option>`).length - 1).toBe(3);
  }
  expect(out).not.toContain("AI companions:");
});

test("trio Start is disabled while a seat is empty", () => {
  expect(trioForm({ tamsin: "u1", odo: "u2" })).toMatch(startDisabled);
});

test("trio Start is disabled while one user holds two seats", () => {
  expect(trioForm({ tamsin: "u1", odo: "u2", kestrel: "u2" })).toMatch(
    startDisabled,
  );
});

test("trio Start is enabled for three distinct users", () => {
  expect(trioForm({ tamsin: "u1", odo: "u2", kestrel: "u3" })).not.toMatch(
    startDisabled,
  );
});

test("startBody on the full trio map keeps all three seats", () => {
  expect(
    startBody("greyhollow-ford-trio", {
      tamsin: "u1",
      odo: "u2",
      kestrel: "u3",
    }),
  ).toEqual({
    seedId: "greyhollow-ford-trio",
    seats: { tamsin: "u1", odo: "u2", kestrel: "u3" },
  });
});

test("a seat naming the DM renders the issue and a disabled Start", () => {
  const out = renderToStaticMarkup(
    <StartSceneForm
      seeds={[
        {
          seedId: "s",
          title: "S",
          humans: [{ characterId: "tamsin", name: "Tamsin" }],
          companions: [],
        },
      ]}
      seedId="s"
      seats={{ tamsin: "dm" }}
      present={[{ userId: "dm", displayName: "Dee" }]}
      dmUserId="dm"
      issues={seatMapIssues(
        [{ characterId: "tamsin", name: "Tamsin" }],
        { tamsin: "dm" },
        "dm",
      )}
      error={null}
      pending={false}
      onSeed={() => {}}
      onSeat={() => {}}
      onStart={() => {}}
    />,
  );
  expect(out).toContain("The DM cannot hold a character seat.");
  expect(out).toMatch(/<button[^>]*disabled[^>]*>Start/);
});
