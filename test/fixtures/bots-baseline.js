import { evaluate, shuffled, rank, suit, random } from "../../public/game/engine/cards.js";
import { personalityToProfile } from "../../public/game/engine/player-settings.js";
const PROFILES = {
  "Tight aggressive": {
    edge: 0.08,
    aggression: 0.6,
    bluff: 0.035,
    sizing: 0.65,
  },
  "Loose aggressive": {
    edge: -0.05,
    aggression: 0.8,
    bluff: 0.15,
    sizing: 0.8,
  },
  "Calling station": {
    edge: -0.14,
    aggression: 0.13,
    bluff: 0.01,
    sizing: 0.4,
  },
  Rock: { edge: 0.16, aggression: 0.3, bluff: 0.005, sizing: 0.65 },
  Balanced: { edge: 0.01, aggression: 0.48, bluff: 0.06, sizing: 0.6 },
  Maniac: { edge: -0.1, aggression: 0.92, bluff: 0.27, sizing: 1.1 },
  Tricky: { edge: 0.02, aggression: 0.55, bluff: 0.12, sizing: 0.55 },
  Casual: { edge: -0.06, aggression: 0.28, bluff: 0.05, sizing: 0.5 },
};
export function estimateEquity(view, rng = random, samples = 72) {
  const known = new Set([...view.hole, ...view.board]);
  const unseen = Array.from({ length: 52 }, (_, i) => i).filter(
    (c) => !known.has(c),
  );
  const opponents = view.players.filter(
    (p) => p.id !== view.id && !p.folded,
  ).length;
  let equity = 0;
  for (let i = 0; i < samples; i++) {
    const deck = shuffled(unseen, rng),
      board = [...view.board];
    while (board.length < 5) board.push(deck.pop());
    const hero = evaluate([...view.hole, ...board]).score;
    let ties = 1,
      beaten = false;
    for (let j = 0; j < opponents; j++) {
      const v = evaluate([deck.pop(), deck.pop(), ...board]).score;
      if (v > hero) {
        beaten = true;
        break;
      }
      if (v === hero) ties++;
    }
    if (!beaten) equity += 1 / ties;
  }
  return equity / samples;
}
export function chooseAction(view, rng = random) {
  const p = view.players.find((p) => p.id === view.id),
    profile = p.personality ? personalityToProfile(p.personality) : (PROFILES[p.style] || PROFILES.Balanced);
  const l = view.legal;
  if (!l) throw new Error("No legal bot action");
  let equity = estimateEquity(view, rng);
  // Small preflop preference for playable, connected hands.
  if (view.board.length === 0) {
    const [a, b] = view.hole;
    if (suit(a) === suit(b)) equity += 0.025;
    if (Math.abs(rank(a) - rank(b)) === 1) equity += 0.015;
  }
  const odds = l.call / (view.pot + l.call || 1),
    noise = (rng() - 0.5) * 0.07;
  const value = equity + noise - profile.edge;
  const bluff = rng() < profile.bluff;
  if (
    l.canRaise &&
    ((value > Math.max(0.43, odds + 0.2) && rng() < profile.aggression) ||
      bluff)
  ) {
    let amount = Math.max(
      l.fullRaiseTo,
      p.bet + l.toCall + Math.round((view.pot + l.call) * profile.sizing),
    );
    if (equity > 0.85 && rng() < 0.25) amount = l.maxRaiseTo;
    return { action: "raise", amount: Math.min(l.maxRaiseTo, amount) };
  }
  if (l.check) return { action: "check" };
  if (value >= odds || (l.call <= view.bigBlind && rng() < 0.16))
    return { action: "call" };
  return { action: "fold" };
}
