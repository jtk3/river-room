// Only allow the four public personality controls; higher values consistently
// mean more of the named quality. Keep the original profiles for older saves.
export const TRAITS = ["selectiveness", "aggression", "bluffing", "betSize"];

export function validatePersonality(personality) {
  if (!personality || typeof personality !== "object") throw new Error("Missing personality");
  const result = {};
  for (const key of TRAITS) {
    const value = personality[key];
    if (!Number.isInteger(value) || value < 0 || value > 100)
      throw new Error(`Invalid ${key}`);
    result[key] = value;
  }
  return result;
}

export function personalityToProfile(personality) {
  const p = validatePersonality(personality);
  return {
    edge: -0.2 + (p.selectiveness / 100) * 0.4,
    aggression: p.aggression / 100,
    bluff: (p.bluffing / 100) * 0.35,
    sizing: 0.1 + (p.betSize / 100) * 1.4,
  };
}

export function validateRoster(roster) {
  if (!Array.isArray(roster) || roster.length !== 8) throw new Error("Expected eight players");
  return roster.map((player, i) => {
    if (!player || typeof player.name !== "string") throw new Error(`Invalid player ${i + 1}`);
    const name = player.name.trim();
    if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name))
      throw new Error(`Invalid name for player ${i + 1}`);
    return { name, personality: validatePersonality(player.personality) };
  });
}
