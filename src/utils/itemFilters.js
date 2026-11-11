import { normalizeProductName } from "./productMatching.js";

export function getSessionParticipantNames(items = []) {
  const names = new Map();
  for (const item of items) {
    const name = typeof item?.addedByName === "string" ? item.addedByName.trim() : "";
    const normalizedName = normalizeProductName(name);
    if (name && normalizedName && !names.has(normalizedName)) {
      names.set(normalizedName, name);
    }
  }
  return [...names.values()].sort((first, second) => first.localeCompare(second, "pt-BR"));
}

export function filterShoppingItems(items = [], query = "", participant = "") {
  const normalizedQuery = normalizeProductName(query);
  const normalizedParticipant = normalizeProductName(participant);

  return items.filter((item) => {
    const matchesName = !normalizedQuery || normalizeProductName(item?.name).includes(normalizedQuery);
    const matchesParticipant = !normalizedParticipant
      || normalizeProductName(item?.addedByName) === normalizedParticipant;
    return matchesName && matchesParticipant;
  });
}
