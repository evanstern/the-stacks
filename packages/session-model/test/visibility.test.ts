import { describe, expect, it } from "vitest";
import { canSee, DM_ONLY, PUBLIC, type Viewer } from "../src/index.js";
import { PLAYER_A, PLAYER_B } from "./helpers.js";

const dm: Viewer = { role: "dm" };
const playerA: Viewer = { role: "player", userId: PLAYER_A };

describe("canSee", () => {
  it("the DM sees public, dm and any whisper", () => {
    expect(canSee(dm, PUBLIC)).toBe(true);
    expect(canSee(dm, DM_ONLY)).toBe(true);
    expect(canSee(dm, PLAYER_A)).toBe(true);
    expect(canSee(dm, PLAYER_B)).toBe(true);
  });

  it("a player sees public", () => {
    expect(canSee(playerA, PUBLIC)).toBe(true);
  });

  it("a player never sees dm", () => {
    expect(canSee(playerA, DM_ONLY)).toBe(false);
  });

  it("a player sees only their own whisper", () => {
    expect(canSee(playerA, PLAYER_A)).toBe(true);
    expect(canSee(playerA, PLAYER_B)).toBe(false);
  });
});
