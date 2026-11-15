import { shuffled, evaluate, random } from "./cards.js";
import { validateRoster } from "./player-settings.js";
export const VERSION = 1;
export const STREETS = ["preflop", "flop", "turn", "river"];
export const BOT_NAMES = [
  "HAL",
  "Data",
  "T2",
  "Vision",
  "R2-D2",
  "Ultron",
  "TARS",
  "K-2SO",
];
export const STYLES = [
  "Tight aggressive",
  "Loose aggressive",
  "Calling station",
  "Rock",
  "Balanced",
  "Maniac",
  "Tricky",
  "Casual",
];
const clone = (s) => structuredClone(s);
const live = (s) => s.players.filter((p) => !p.folded);
const capable = (s) => live(s).filter((p) => p.stack > 0);
export const pot = (s) => s.players.reduce((n, p) => n + p.total, 0);
export function log(s, message) {
  s.log.push(message);
  s.log = s.log.slice(-90);
}
export function createGame(opponents = 5, roster = null) {
  if (!Number.isInteger(opponents) || opponents < 1 || opponents > 8)
    throw new Error("Choose 1–8 opponents");
  const settings = roster === null ? null : validateRoster(roster);
  const players = [
    {
      id: 0,
      seat: 0,
      name: "You",
      style: "Human",
      stack: 1000,
      bet: 0,
      total: 0,
      hole: [],
      folded: false,
    },
  ];
  for (let i = 0; i < opponents; i++)
    players.push({
      id: i + 1,
      seat: Math.round(((i + 1) * 9) / (opponents + 1)),
      name: settings ? settings[i].name : BOT_NAMES[i],
      style: STYLES[i],
      ...(settings ? { personality: settings[i].personality } : {}),
      stack: 1000,
      bet: 0,
      total: 0,
      hole: [],
      folded: false,
    });
  return {
    version: VERSION,
    players,
    button: -1,
    smallBlind: 5,
    bigBlind: 10,
    hand: 0,
    phase: "waiting",
    board: [],
    deck: [],
    burns: [],
    actor: null,
    currentBet: 0,
    minRaise: 10,
    log: [],
    actionHistory: [],
    awards: [],
    heroBuyins: 1000,
    bankroll: 1000 * players.length,
  };
}
function next(s, id, predicate = () => true) {
  for (let step = 1; step <= s.players.length; step++) {
    const p = s.players[(id + step + s.players.length) % s.players.length];
    if (predicate(p)) return p.id;
  }
  return null;
}
function pay(p, amount) {
  const n = Math.min(amount, p.stack);
  p.stack -= n;
  p.bet += n;
  p.total += n;
  return n;
}
export function startHand(input, rng = random) {
  if (!["waiting", "complete"].includes(input.phase))
    throw new Error("Finish the current hand first");
  if (input.players[0].stack <= 0) throw new Error("Rebuy to keep playing");
  const s = clone(input);
  for (const p of s.players) {
    if (p.id && p.stack === 0) {
      p.stack = 1000;
      s.bankroll += 1000;
      log(s, `${p.name} rebuys for 1,000.`);
    }
    Object.assign(p, {
      hole: [],
      bet: 0,
      total: 0,
      folded: false,
      acted: false,
      reopenAt: 0,
      lastAction: "",
    });
  }
  s.button = next(s, s.button);
  s.hand++;
  s.phase = "preflop";
  s.board = [];
  s.actionHistory = [];
  s.burns = [];
  s.deck = shuffled(undefined, rng);
  s.awards = [];
  s.currentBet = s.bigBlind;
  s.minRaise = s.bigBlind;
  s.showdown = false;
  // Deal one card at a time, starting left of the dealer.
  for (let round = 0; round < 2; round++)
    for (let step = 1; step <= s.players.length; step++)
      s.players[(s.button + step) % s.players.length].hole.push(s.deck.pop());
  s.sb = s.players.length === 2 ? s.button : next(s, s.button);
  s.bb = next(s, s.sb);
  const a = pay(s.players[s.sb], s.smallBlind),
    b = pay(s.players[s.bb], s.bigBlind);
  s.players[s.sb].lastAction = `SB ${a}`;
  s.players[s.bb].lastAction = `BB ${b}`;
  log(
    s,
    `Hand #${s.hand} · ${s.players[s.button].name} deals. Blinds ${a}/${b}.`,
  );
  s.actor = next(s, s.bb, (p) => !p.folded && p.stack > 0);
  advance(s, s.bb);
  return s;
}
export function legalActions(s, id = s.actor) {
  if (!STREETS.includes(s.phase) || id !== s.actor || id === null) return null;
  const p = s.players[id],
    toCall = Math.max(0, s.currentBet - p.bet),
    max = p.bet + p.stack;
  const reopened = !p.acted || s.currentBet >= p.reopenAt;
  const contest = capable(s).some((o) => o.id !== id);
  const min = s.currentBet === 0 ? s.bigBlind : s.currentBet + s.minRaise;
  return {
    fold: true,
    check: toCall === 0,
    call: Math.min(toCall, p.stack),
    toCall,
    minRaiseTo: Math.min(min, max),
    fullRaiseTo: min,
    maxRaiseTo: max,
    canRaise: reopened && contest && max > s.currentBet,
  };
}
export function act(input, id, action, amount) {
  const s = clone(input),
    legal = legalActions(s, id);
  if (!legal) throw new Error("It is not your turn");
  const p = s.players[id];
  const event = {
    playerId: id,
    street: s.phase,
    action,
    toCall: legal.toCall,
    potBefore: pot(s),
    currentBet: s.currentBet,
    playerBet: p.bet,
    stackBefore: p.stack,
    board: [...s.board],
  };
  if (action === "fold") {
    p.folded = true;
    p.lastAction = "Fold";
  } else if (action === "check") {
    if (!legal.check) throw new Error("You must call or fold");
    p.lastAction = "Check";
  } else if (action === "call") {
    if (!legal.toCall) throw new Error("Nothing to call");
    const paid = pay(p, legal.call);
    p.lastAction = `Call ${paid}`;
  } else if (action === "raise") {
    if (
      !legal.canRaise ||
      !Number.isSafeInteger(amount) ||
      amount < legal.minRaiseTo ||
      amount > legal.maxRaiseTo
    )
      throw new Error("Illegal raise size");
    const old = s.currentBet;
    pay(p, amount - p.bet);
    s.currentBet = amount;
    if (amount - old >= s.minRaise) s.minRaise = amount - old;
    p.lastAction = `${old === 0 ? "Bet" : "Raise to"} ${amount}`;
  } else throw new Error("Unknown action");
  event.amount = action === "raise" ? amount : action === "call" ? legal.call : 0;
  (s.actionHistory ||= []).push(event);
  p.acted = true;
  p.reopenAt = s.currentBet + s.minRaise;
  if (p.stack === 0 && !p.folded) p.lastAction += " · All-in";
  log(s, `${p.name}: ${p.lastAction}.`);
  advance(s, id);
  return s;
}
function needsAction(s, p) {
  if (p.folded || p.stack === 0) return false;
  // A lone player with chips cannot bet into an uncontested side pot.
  if (capable(s).length === 1 && p.bet >= s.currentBet) return false;
  return !p.acted || p.bet < s.currentBet;
}
function advance(s, after) {
  if (live(s).length === 1) {
    settle(s, false);
    return;
  }
  const actor = next(s, after, (p) => needsAction(s, p));
  if (actor !== null) {
    s.actor = actor;
    return;
  }
  if (s.phase === "river") {
    settle(s, true);
    return;
  }
  s.phase = STREETS[STREETS.indexOf(s.phase) + 1];
  s.burns.push(s.deck.pop());
  for (let i = 0; i < (s.phase === "flop" ? 3 : 1); i++)
    s.board.push(s.deck.pop());
  for (const p of s.players) {
    p.bet = 0;
    p.acted = false;
    p.reopenAt = 0;
    p.lastAction = p.folded ? "Fold" : p.stack === 0 ? "All-in" : "";
  }
  s.currentBet = 0;
  s.minRaise = s.bigBlind;
  log(s, `${s.phase[0].toUpperCase() + s.phase.slice(1)}.`);
  s.actor = next(s, s.button, (p) => needsAction(s, p));
  if (s.actor === null) advance(s, s.button);
}
export function settle(s, showdown = true) {
  const levels = [
    ...new Set(s.players.map((p) => p.total).filter(Boolean)),
  ].sort((a, b) => a - b);
  const ranks = new Map();
  if (showdown)
    for (const p of live(s)) ranks.set(p.id, evaluate([...s.board, ...p.hole]));
  s.awards = [];
  let previous = 0;
  const pots = [];
  for (const level of levels) {
    const contributors = s.players.filter((p) => p.total >= level),
      chips = (level - previous) * contributors.length;
    previous = level;
    const eligible = showdown ? contributors.filter((p) => !p.folded) : live(s);
    const key =
      contributors.length === 1
        ? `refund-${contributors[0].id}`
        : eligible.map((p) => p.id).join(",");
    const prior = pots.at(-1);
    if (prior && prior.key === key) prior.chips += chips;
    else pots.push({ key, chips, contributors, eligible });
  }
  for (const { chips, contributors, eligible } of pots) {
    if (contributors.length === 1) {
      const p = contributors[0];
      p.stack += chips;
      s.awards.push({ amount: chips, winners: [p.id], refund: true });
      log(s, `${p.name}: ${chips} uncalled chips returned.`);
      continue;
    }
    if (!eligible.length) throw new Error("Pot has no eligible player");
    const best = showdown
      ? Math.max(...eligible.map((p) => ranks.get(p.id).score))
      : 0;
    const winners = eligible.filter(
      (p) => !showdown || ranks.get(p.id).score === best,
    );
    const order = winners
      .slice()
      .sort(
        (a, b) =>
          ((a.id - s.button - 1 + s.players.length) % s.players.length) -
          ((b.id - s.button - 1 + s.players.length) % s.players.length),
      );
    let remainder = chips % winners.length;
    for (const p of order)
      p.stack += Math.floor(chips / winners.length) + (remainder-- > 0 ? 1 : 0);
    const name =
      s.awards.filter((a) => !a.refund).length === 0 ? "Main pot" : "Side pot";
    s.awards.push({
      amount: chips,
      winners: winners.map((p) => p.id),
      name,
      hand: showdown ? ranks.get(winners[0].id).name : "Uncontested",
    });
    log(
      s,
      `${winners.map((p) => p.name).join(" & ")} ${winners.length > 1 ? "split" : "wins"} ${chips} · ${showdown ? ranks.get(winners[0].id).name : "everyone folded"}.`,
    );
  }
  s.showdown = showdown;
  s.finalPot = pot(s);
  s.phase = "complete";
  s.actor = null;
  for (const p of s.players) {
    p.total = 0;
    p.bet = 0;
  }
}
export function rebuy(input) {
  if (!["waiting", "complete"].includes(input.phase))
    throw new Error("Rebuy between hands");
  if (input.players[0].stack > 0)
    throw new Error("Rebuy is available when your stack is empty");
  const s = clone(input);
  s.players[0].stack = 1000;
  s.bankroll += 1000;
  s.heroBuyins = (s.heroBuyins || 1000) + 1000;
  log(s, "You rebuy for 1,000.");
  return s;
}
// Deliberately excludes opponents’ hole cards, the deck, and burned cards.
export function botView(s, id) {
  return {
    id,
    hole: [...s.players[id].hole],
    board: [...s.board],
    phase: s.phase,
    button: s.button,
    actionHistory: (s.actionHistory || []).map((a) => ({ ...a, board: [...a.board] })),
    pot: pot(s),
    bigBlind: s.bigBlind,
    legal: legalActions(s, id),
    players: s.players.map(({ id, stack, bet, folded, style, personality }) => ({
      id,
      stack,
      bet,
      folded,
      style,
      ...(personality ? { personality: { ...personality } } : {}),
    })),
  };
}
