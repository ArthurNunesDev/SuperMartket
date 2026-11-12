import { isValidLocation } from "./locationSharing.js";

export function applySessionLocationUpdate(currentLocations, userId, location, name, tabId = "default") {
  if (!currentLocations || typeof currentLocations !== "object" || typeof userId !== "string" || !userId.trim()
    || typeof tabId !== "string" || !tabId.trim()) {
    return currentLocations ?? {};
  }

  const participant = currentLocations[userId] ?? { name: "Participante", tabs: {} };
  const tabs = { ...(participant.tabs ?? {}) };

  if (location == null) {
    if (!Object.prototype.hasOwnProperty.call(tabs, tabId)) return currentLocations;
    delete tabs[tabId];
  } else {
    if (!isValidLocation(location)) return currentLocations;
    tabs[tabId] = location;
  }

  const nextLocations = { ...currentLocations };
  if (Object.keys(tabs).length === 0) {
    delete nextLocations[userId];
  } else {
    nextLocations[userId] = {
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 50) : participant.name,
      tabs,
    };
  }
  return nextLocations;
}

export function getLatestSessionLocation(participantLocations) {
  if (!participantLocations || typeof participantLocations !== "object") return null;
  return Object.values(participantLocations.tabs ?? {})
    .filter(isValidLocation)
    .reduce((latest, location) => (
      !latest || Date.parse(location.updatedAt) > Date.parse(latest.updatedAt) ? location : latest
    ), null);
}
