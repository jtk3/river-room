// Career totals use completed-hand chip deltas. Buy-ins and rebuys occur
// outside a hand, so they cannot be mistaken for winnings.
const integer = (n) => Number.isSafeInteger(n) && n >= 0;

export function handResults(startStacks, finalStacks) {
  if (!Array.isArray(startStacks) || !Array.isArray(finalStacks) ||
      startStacks.length < 2 || startStacks.length !== finalStacks.length ||
      !startStacks.every(integer) || !finalStacks.every(integer))
    throw new Error("Invalid hand stacks");
  const deltas = startStacks.map((stack, i) => finalStacks[i] - stack);
  if (deltas.reduce((sum, n) => sum + n, 0) !== 0)
    throw new Error("Hand results must conserve chips");
  return deltas;
}

export function careerTotals(events) {
  const seen = new Set(), players = new Map();
  for (const event of events) {
    if (!event || typeof event.id !== "string" || !event.id || !Array.isArray(event.players))
      throw new Error("Invalid hand event");
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    const ids = new Set();
    for (const player of event.players) {
      if (!player || typeof player.id !== "string" || !player.id ||
          !Number.isSafeInteger(player.net) || ids.has(player.id))
        throw new Error("Invalid player result");
      ids.add(player.id);
      const result = players.get(player.id) ?? { id: player.id, net: 0, hands: 0 };
      result.net += player.net;
      result.hands++;
      if (!Number.isSafeInteger(result.net)) throw new Error("Career total overflow");
      players.set(player.id, result);
    }
  }
  return [...players.values()].map(p => ({ ...p, per100: p.net * 100 / p.hands }))
    .sort((a, b) => b.net - a.net || a.id.localeCompare(b.id));
}
