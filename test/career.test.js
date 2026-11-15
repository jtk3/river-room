import test from "node:test";
import assert from "node:assert/strict";
import { handResults, careerTotals } from "../public/game/engine/career.js";

test("completed hands count net changes, not total buy-ins or stack sizes", () => {
  assert.deepEqual(handResults([1000, 3000, 1000], [1800, 2200, 1000]), [800, -800, 0]);
  assert.deepEqual(handResults([1000, 2200, 1000], [0, 3200, 1000]), [-1000, 1000, 0]);
  assert.throws(() => handResults([1000, 1000], [1000, 1001]));
});

test("career aggregation ignores duplicate hand events and ranks by net", () => {
  const first = { id: "table-1-hand-1", players: [{ id: "lynette", net: 800 }, { id: "hal", net: -800 }] };
  const next = { id: "table-1-hand-2", players: [{ id: "lynette", net: -200 }, { id: "hal", net: 200 }] };
  assert.deepEqual(careerTotals([first, first, next]), [
    { id: "lynette", net: 600, hands: 2, per100: 30000 },
    { id: "hal", net: -600, hands: 2, per100: -30000 },
  ]);
});

test("bad and duplicate player entries cannot silently corrupt aggregates", () => {
  assert.throws(() => careerTotals([{ id: "h", players: [{ id: "p", net: 1 }, { id: "p", net: 2 }] }]));
  assert.throws(() => careerTotals([{ id: "h", players: [{ id: "p", net: 1.5 }] }]));
});
