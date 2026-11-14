import test from "node:test";
import assert from "node:assert/strict";
import {
  createGame,
  startHand,
  act,
  legalActions,
  settle,
  botView,
  rebuy,
  pot,
} from "../dist/engine/holdem.js";
import { evaluate, shuffled, RANKS, SUITS } from "../dist/engine/cards.js";
import { chooseAction } from "../dist/engine/bots.js";
import {
  saveGame,
  loadGame,
  validateState,
  SAVE_KEY,
} from "../dist/engine/storage.js";
const cards = (s) =>
  s.split(" ").map((c) => SUITS.indexOf(c[1]) * 13 + RANKS.indexOf(c[0]));
function seeded(seed = 42) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}
function streetState(stacks, phase = "preflop") {
  const s = startHand(createGame(stacks.length - 1), seeded());
  s.phase = phase;
  s.currentBet = 0;
  s.minRaise = 10;
  s.actor = 0;
  s.board = [];
  for (const p of s.players)
    Object.assign(p, {
      stack: stacks[p.id],
      bet: 0,
      total: 0,
      acted: false,
      reopenAt: 0,
      folded: false,
    });
  s.bankroll = stacks.reduce((n, x) => n + x, 0);
  return s;
}
test("hand ranking, wheel, all kickers, double trips, three pairs, royal flush", () => {
  const hands = [
    "Ac Kd 9s 7h 3c",
    "Ac Ad 9s 7h 3c",
    "Ac Ad 9s 9h 3c",
    "Ac Ad As 7h 3c",
    "Ac 2d 3s 4h 5c",
    "Ac Jc 9c 7c 3c",
    "Ac Ad As 7h 7c",
    "Ac Ad As Ah 3c",
    "Tc Jc Qc Kc Ac",
  ];
  const scores = hands.map((h, i) => {
    const e = evaluate(cards(h));
    assert.equal(e.category, i);
    return e.score;
  });
  assert.deepEqual(
    [...scores].sort((a, b) => a - b),
    scores,
  );
  assert.ok(
    evaluate(cards("2c 3d 4h 5s 6c")).score >
      evaluate(cards("Ac 2d 3s 4h 5c")).score,
  );
  assert.equal(
    evaluate(cards("Ac Ad As Kc Kd Ks 2c")).score,
    evaluate(cards("Ac Ad As Kc Kd")).score,
  );
  assert.equal(
    evaluate(cards("Ac Ad Kc Kd Qs Qh Jc")).score,
    evaluate(cards("Ac Ad Kc Kd Qs")).score,
  );
  assert.ok(
    evaluate(cards("Ac Ad Ks Qh Jc")).score >
      evaluate(cards("Ac Ad Ks Qh Tc")).score,
  );
  assert.equal(
    evaluate(cards("Ac Kc Qc Jc Tc 2s 3h")).score,
    evaluate(cards("Ac Kc Qc Jc Tc 4d 5s")).score,
  );
});
test("seven-card evaluator equals exhaustive best-of-five on 1,000 seeded deals", () => {
  const rng = seeded(5);
  for (let n = 0; n < 1000; n++) {
    const seven = shuffled(undefined, rng).slice(0, 7);
    let best = 0;
    for (let i = 0; i < 7; i++)
      for (let j = i + 1; j < 7; j++)
        best = Math.max(
          best,
          evaluate(seven.filter((_, k) => k !== i && k !== j)).score,
        );
    assert.equal(evaluate(seven).score, best);
  }
});
test("heads-up dealer posts small blind, acts first preflop and last postflop", () => {
  let s = startHand(createGame(1), seeded());
  assert.equal(s.button, 0);
  assert.equal(s.sb, 0);
  assert.equal(s.bb, 1);
  assert.equal(s.actor, 0);
  s = act(s, 0, "call");
  assert.equal(s.actor, 1);
  assert.equal(legalActions(s).check, true);
  s = act(s, 1, "check");
  assert.equal(s.phase, "flop");
  assert.equal(s.actor, 1);
  assert.equal(s.board.length, 3);
  assert.equal(s.burns.length, 1);
  while (s.phase !== "complete") s = act(s, s.actor, "check");
  s = startHand(s, seeded(9));
  assert.equal(s.button, 1);
  assert.equal(s.actor, 1);
});
test("big blind gets option; multiple players act clockwise and empty seats are skipped", () => {
  let s = startHand(createGame(4), seeded());
  assert.equal(s.actor, 3);
  for (const id of [3, 4, 0, 1]) {
    assert.equal(s.actor, id);
    s = act(s, id, "call");
  }
  assert.equal(s.actor, 2);
  assert.equal(legalActions(s).check, true);
  s = act(s, 2, "check");
  assert.equal(s.phase, "flop");
  assert.equal(s.actor, 1);
});
test("full raise increments and illegal actions leave the original game unchanged", () => {
  let s = startHand(createGame(3), seeded());
  const old = JSON.stringify(s);
  assert.throws(() => act(s, s.actor, "check"));
  assert.throws(() => act(s, s.actor, "raise", 19));
  assert.throws(() => act(s, s.actor, "raise", 20.5));
  assert.throws(() => act(s, (s.actor + 1) % 4, "call"));
  assert.equal(JSON.stringify(s), old);
  s = act(s, s.actor, "raise", 30);
  assert.equal(legalActions(s).minRaiseTo, 50);
  s = act(s, s.actor, "raise", 80);
  assert.equal(legalActions(s).minRaiseTo, 130);
});
test("a short all-in does not reopen betting for players who already acted", () => {
  let s = streetState([100, 15, 100]);
  s = act(s, 0, "raise", 10);
  s = act(s, 1, "raise", 15);
  assert.equal(legalActions(s).canRaise, true);
  assert.equal(legalActions(s).minRaiseTo, 25);
  s = act(s, 2, "call");
  assert.equal(s.actor, 0);
  assert.equal(legalActions(s).toCall, 5);
  assert.equal(legalActions(s).canRaise, false);
  assert.throws(() => act(s, 0, "raise", 25));
  s = act(s, 0, "call");
  assert.equal(s.phase, "flop");
});
test("cumulative short all-ins reopen action by the last full increment", () => {
  let s = streetState([100, 15, 20, 100]);
  s = act(s, 0, "raise", 10);
  s = act(s, 1, "raise", 15);
  s = act(s, 2, "raise", 20);
  s = act(s, 3, "call");
  assert.equal(s.actor, 0);
  assert.equal(s.minRaise, 10);
  assert.equal(legalActions(s).canRaise, true);
  assert.equal(legalActions(s).minRaiseTo, 30);
});
test("short opening all-in requires a full increment to raise, never a completion", () => {
  let s = streetState([4, 100, 100], "flop");
  s = act(s, 0, "raise", 4);
  assert.equal(legalActions(s).minRaiseTo, 14);
  assert.throws(() => act(s, 1, "raise", 10));
});
test("short calls, automatic all-in runout, and unmatched chips returned", () => {
  let s = streetState([100, 35]);
  s = act(s, 0, "raise", 100);
  assert.equal(legalActions(s).call, 35);
  assert.equal(legalActions(s).canRaise, false);
  s = act(s, 1, "call");
  assert.equal(s.phase, "complete");
  assert.equal(s.board.length, 5);
  assert.equal(s.burns.length, 3);
  assert.deepEqual(
    s.awards.find((a) => a.refund),
    { amount: 65, winners: [0], refund: true },
  );
  assert.equal(
    s.players.reduce((n, p) => n + p.stack, 0),
    135,
  );
});
test("no uncontested side-pot betting when only one player retains chips", () => {
  let s = streetState([100, 10]);
  s = act(s, 0, "raise", 10);
  s = act(s, 1, "call");
  assert.equal(s.phase, "complete");
  assert.equal(s.board.length, 5);
});
test("short big blind preserves full bring-in", () => {
  let s = createGame(1);
  s.players[1].stack = 3;
  s.bankroll = 1003;
  s = startHand(s, seeded());
  assert.equal(s.currentBet, 10);
  assert.equal(s.players[1].bet, 3);
  assert.equal(legalActions(s).toCall, 5);
  assert.equal(legalActions(s).canRaise, false);
  s = act(s, 0, "call");
  assert.equal(s.phase, "complete");
  assert.equal(s.awards.find((a) => a.refund).amount, 7);
});
test("main and side pots honor eligibility; folded contributions remain", () => {
  const s = streetState([0, 0, 0, 0]);
  s.board = cards("2c 3d 7h 8s 9c");
  s.players[0].hole = cards("Ac Ad");
  s.players[1].hole = cards("Kc Kd");
  s.players[2].hole = cards("Qc Qd");
  s.players[3].hole = cards("Jc Jd");
  [50, 100, 200, 200].forEach((n, i) => (s.players[i].total = n));
  s.players[3].folded = true;
  settle(s, true);
  assert.deepEqual(
    s.players.map((p) => p.stack),
    [200, 150, 200, 0],
  );
  assert.equal(s.finalPot, 550);
});
test("tied pots split exactly and odd chips go clockwise left of dealer", () => {
  const s = streetState([0, 0, 0]);
  s.button = 0;
  s.board = cards("Ac Kc Qc Jc Tc");
  s.players[0].hole = cards("2d 3d");
  s.players[1].hole = cards("4d 5d");
  s.players[2].hole = cards("6d 7d");
  for (const p of s.players) p.total = 5;
  s.players[2].folded = true;
  settle(s, true);
  assert.deepEqual(
    s.players.map((p) => p.stack),
    [7, 8, 0],
  );
  assert.equal(s.awards[0].winners.length, 2);
});
test("everyone folding wins immediately without exposing a board", () => {
  let s = startHand(createGame(1), seeded());
  s = act(s, 0, "fold");
  assert.equal(s.phase, "complete");
  assert.equal(s.showdown, false);
  assert.equal(s.board.length, 0);
  assert.equal(s.players[1].stack, 1005);
});
test("save/resume round trip reproduces exact subsequent deal and rejects corruption", () => {
  const storage = new Map(),
    adapter = {
      getItem: (k) => storage.get(k),
      setItem: (k, v) => storage.set(k, v),
    };
  let s = startHand(createGame(3), seeded());
  s = act(s, s.actor, "call");
  saveGame(s, adapter);
  let restored = loadGame(adapter);
  assert.deepEqual(restored, s);
  while (s.phase !== "complete") {
    const l = legalActions(s),
      action = l.check ? "check" : "call";
    s = act(s, s.actor, action);
    restored = act(restored, restored.actor, action);
  }
  assert.deepEqual(restored, s);
  assert.ok(storage.has(SAVE_KEY));
  const corrupt = structuredClone(s);
  corrupt.players[0].stack++;
  assert.throws(() => validateState(corrupt));
  const duplicate = structuredClone(s);
  duplicate.deck[0] = duplicate.board[0];
  assert.throws(() => validateState(duplicate));
  assert.throws(() => validateState({ ...s, version: 999 }));
});
test("bot input excludes all private opponent cards, deck, and burns", () => {
  const s = startHand(createGame(8), seeded()),
    view = botView(s, s.actor);
  assert.equal(view.deck, undefined);
  assert.equal(view.burns, undefined);
  assert.deepEqual(view.hole, s.players[s.actor].hole);
  assert.ok(view.players.every((p) => p.hole === undefined));
  const altered = structuredClone(s);
  altered.deck.reverse();
  altered.players.find((p) => p.id !== s.actor).hole.reverse();
  assert.deepEqual(
    chooseAction(view, seeded(66)),
    chooseAction(botView(altered, s.actor), seeded(66)),
  );
});
test("rebuys happen between hands and preserve accounting", () => {
  let s = createGame(1);
  s.players[0].stack = 0;
  s.bankroll = 1000;
  s = rebuy(s);
  assert.equal(s.bankroll, 2000);
  assert.equal(s.players[0].stack, 1000);
  assert.throws(() => rebuy(startHand(s, seeded())));
  assert.throws(() => rebuy(s));
  s.players[1].stack = 0;
  s.bankroll = 1000;
  s = startHand(s, seeded());
  assert.equal(s.bankroll, 2000);
  assert.equal(s.players[1].stack + s.players[1].total, 1000);
});
test("1–8 opponents: 800 seeded random hands conserve chips and always terminate", () => {
  const rng = seeded(123);
  for (let opponents = 1; opponents <= 8; opponents++) {
    let s = createGame(opponents);
    for (let h = 0; h < 100; h++) {
      if (!s.players[0].stack) s = rebuy(s);
      s = startHand(s, rng);
      let turns = 0;
      while (s.phase !== "complete") {
        assert.ok(turns++ < 200, "hand stalled");
        validateState(s);
        const l = legalActions(s),
          r = rng();
        let action, amount;
        if (l.canRaise && r < 0.3) {
          action = "raise";
          amount = Math.min(
            l.maxRaiseTo,
            l.fullRaiseTo + Math.floor(rng() * 200),
          );
        } else if (!l.check && r > 0.86) action = "fold";
        else action = l.check ? "check" : "call";
        s = act(s, s.actor, action, amount);
      }
      validateState(s);
      assert.equal(pot(s), 0);
      assert.equal(
        s.players.reduce((n, p) => n + p.stack, 0),
        s.bankroll,
      );
    }
  }
});
test("all eight bot styles produce legal actions over complete cash-game sessions", () => {
  const rng = seeded(555);
  let s = createGame(8);
  for (let h = 0; h < 30; h++) {
    if (s.players[0].stack === 0) s = rebuy(s);
    s = startHand(s, rng);
    let turns = 0;
    while (s.phase !== "complete") {
      assert.ok(turns++ < 200);
      const decision = chooseAction(botView(s, s.actor), rng);
      s = act(s, s.actor, decision.action, decision.amount);
      validateState(s);
    }
  }
});
