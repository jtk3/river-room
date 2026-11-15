import test from "node:test";
import assert from "node:assert/strict";
import { createGame, startHand, botView } from "../dist/engine/holdem.js";
import { personalityToProfile, validateRoster } from "../dist/engine/player-settings.js";
import { chooseAction } from "../dist/engine/bots.js";
import { saveGame, loadGame } from "../dist/engine/storage.js";

const traits = { selectiveness: 50, aggression: 50, bluffing: 50, betSize: 50 };
const roster = Array.from({ length: 8 }, (_, i) => ({ name: `Player ${i + 1}`, personality: { ...traits } }));

test("slider endpoints map to bounded, ordered bot behavior", () => {
  const low = personalityToProfile(Object.fromEntries(Object.keys(traits).map(k => [k, 0])));
  const high = personalityToProfile(Object.fromEntries(Object.keys(traits).map(k => [k, 100])));
  for (const k of Object.keys(low)) assert.ok(low[k] < high[k]);
  for (const invalid of [-1, 101, 0.5, "50", null])
    assert.throws(() => personalityToProfile({ ...traits, aggression: invalid }));
});

test("roster validation rejects invalid names and incomplete rosters", () => {
  assert.throws(() => validateRoster(roster.slice(0, 7)));
  assert.throws(() => validateRoster([{ ...roster[0], name: "  " }, ...roster.slice(1)]));
  assert.throws(() => validateRoster([{ ...roster[0], name: "A".repeat(33) }, ...roster.slice(1)]));
});

test("new game snapshots player settings while old saves remain compatible", () => {
  const game = createGame(1, roster);
  roster[0].name = "Changed later";
  roster[0].personality.aggression = 99;
  assert.equal(game.players[1].name, "Player 1");
  assert.equal(game.players[1].personality.aggression, 50);
  const started = startHand(game, () => 0.5);
  const view = botView(started, 1);
  assert.deepEqual(view.players[1].personality, traits);
  const store = new Map();
  const storage = { setItem: (k, v) => store.set(k, v), getItem: k => store.get(k) ?? null };
  saveGame(started, storage);
  assert.deepEqual(loadGame(storage), started);
  saveGame(startHand(createGame(1), () => 0.5), storage);
  assert.equal(loadGame(storage).players[1].personality, undefined);
});
