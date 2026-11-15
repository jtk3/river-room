export const RANKS = "23456789TJQKA";
export const SUITS = "cdhs";
export const HAND_NAMES = [
  "High card",
  "One pair",
  "Two pair",
  "Three of a kind",
  "Straight",
  "Flush",
  "Full house",
  "Four of a kind",
  "Straight flush",
];
export const rank = (c) => (c % 13) + 2;
export const suit = (c) => Math.floor(c / 13);
export const label = (c) => RANKS[c % 13] + SUITS[suit(c)];
export function random() {
  return crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
}
export function shuffled(
  cards = Array.from({ length: 52 }, (_, i) => i),
  rng = random,
) {
  const a = [...cards];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const straightHigh = (values) => {
  const s = new Set(values);
  if (s.has(14)) s.add(1);
  for (let h = 14; h >= 5; h--)
    if ([0, 1, 2, 3, 4].every((d) => s.has(h - d))) return h;
  return 0;
};
// Evaluate the best five cards directly; base-15 digits preserve all kickers.
export function evaluate(cards) {
  if (
    cards.length < 5 ||
    cards.length > 7 ||
    new Set(cards).size !== cards.length
  )
    throw new Error("Expected five to seven distinct cards");
  const counts = new Map(),
    suits = [[], [], [], []];
  for (const c of cards) {
    const r = rank(c);
    counts.set(r, (counts.get(r) || 0) + 1);
    suits[suit(c)].push(r);
  }
  const values = [...counts.keys()].sort((a, b) => b - a);
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = suits.find((a) => a.length >= 5)?.sort((a, b) => b - a);
  let digits;
  if (flush && straightHigh(flush)) digits = [8, straightHigh(flush)];
  else if (groups[0][1] === 4)
    digits = [7, groups[0][0], values.find((r) => r !== groups[0][0])];
  else if (groups[0][1] === 3 && groups[1][1] >= 2)
    digits = [6, groups[0][0], groups[1][0]];
  else if (flush) digits = [5, ...flush.slice(0, 5)];
  else if (straightHigh(values)) digits = [4, straightHigh(values)];
  else if (groups[0][1] === 3)
    digits = [
      3,
      groups[0][0],
      ...values.filter((r) => r !== groups[0][0]).slice(0, 2),
    ];
  else if (groups[0][1] === 2 && groups[1][1] === 2) {
    const pairs = groups
      .filter((g) => g[1] === 2)
      .map((g) => g[0])
      .sort((a, b) => b - a);
    digits = [
      2,
      ...pairs.slice(0, 2),
      values.find((r) => !pairs.slice(0, 2).includes(r)),
    ];
  } else if (groups[0][1] === 2)
    digits = [
      1,
      groups[0][0],
      ...values.filter((r) => r !== groups[0][0]).slice(0, 3),
    ];
  else digits = [0, ...values.slice(0, 5)];
  const category = digits[0];
  while (digits.length < 6) digits.push(0);
  return {
    score: digits.reduce((n, d) => n * 15 + d, 0),
    category,
    name: HAND_NAMES[category],
  };
}
