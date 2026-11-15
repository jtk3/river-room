import { VERSION, STREETS, BOT_NAMES } from "./holdem.js";
export const SAVE_KEY = "river-room.save.v1";
export function validateState(s) {
  if (
    !s ||
    s.version !== VERSION ||
    !Array.isArray(s.players) ||
    s.players.length < 2 ||
    s.players.length > 9
  )
    throw new Error("Unsupported save");
  if (
    !["waiting", "complete", ...STREETS].includes(s.phase) ||
    !Number.isSafeInteger(s.hand) ||
    s.hand < 0
  )
    throw new Error("Invalid game");
  if (
    s.smallBlind !== 5 ||
    s.bigBlind !== 10 ||
    !Number.isSafeInteger(s.bankroll)
  )
    throw new Error("Invalid stakes");
  const seats = new Set();
  let chips = 0;
  for (const [i, p] of s.players.entries()) {
    if (
      p.id !== i ||
      !Number.isInteger(p.seat) ||
      p.seat < 0 ||
      p.seat > 8 ||
      seats.has(p.seat) ||
      typeof p.name !== "string" ||
      typeof p.style !== "string"
    )
      throw new Error("Invalid seat");
    seats.add(p.seat);
    for (const field of ["stack", "bet", "total"])
      if (!Number.isSafeInteger(p[field]) || p[field] < 0)
        throw new Error("Invalid chips");
    if (p.bet > p.total) throw new Error("Invalid bet");
    chips += p.stack + p.total;
    if (!Array.isArray(p.hole) || ![0, 2].includes(p.hole.length))
      throw new Error("Invalid hole cards");
  }
  if (
    chips !== s.bankroll ||
    !Array.isArray(s.board) ||
    ![0, 3, 4, 5].includes(s.board.length)
  )
    throw new Error("Invalid balance");
  const all = [
    ...s.deck,
    ...s.burns,
    ...s.board,
    ...s.players.flatMap((p) => p.hole),
  ];
  if (
    all.some((c) => !Number.isInteger(c) || c < 0 || c > 51) ||
    new Set(all).size !== all.length ||
    (s.hand > 0 && all.length !== 52)
  )
    throw new Error("Invalid cards");
  if (
    !Number.isInteger(s.button) ||
    s.button < -1 ||
    s.button >= s.players.length
  )
    throw new Error("Invalid button");
  if (
    !Number.isSafeInteger(s.currentBet) ||
    s.currentBet < 0 ||
    !Number.isSafeInteger(s.minRaise) ||
    s.minRaise < 10
  )
    throw new Error("Invalid betting");
  if (
    !Array.isArray(s.log) ||
    s.log.some((l) => typeof l !== "string") ||
    !Array.isArray(s.awards)
  )
    throw new Error("Invalid history");
  if (STREETS.includes(s.phase)) {
    const p = s.players[s.actor];
    if (!p || p.folded || p.stack <= 0) throw new Error("Invalid turn");
    const boardLength = { preflop: 0, flop: 3, turn: 4, river: 5 };
    if (s.board.length !== boardLength[s.phase])
      throw new Error("Invalid street");
    for (const p of s.players)
      if (typeof p.acted !== "boolean" || !Number.isFinite(p.reopenAt))
        throw new Error("Invalid action");
  } else if (s.actor !== null) throw new Error("Invalid turn");
  return s;
}
export function saveGame(state, storage = localStorage) {
  validateState(state);
  storage.setItem(SAVE_KEY, JSON.stringify(state));
}
export function loadGame(storage = localStorage) {
  const raw = storage.getItem(SAVE_KEY);
  if (!raw) return null;
  const state = validateState(JSON.parse(raw));
  const oldNames = ["Mara", "Felix", "Jun", "Cleo", "Atlas", "Nico", "Sage", "Remy"];
  for (const p of state.players.slice(1)) {
    if (!p.personality && p.name === oldNames[p.id - 1]) p.name = BOT_NAMES[p.id - 1];
  }
  return state;
}
