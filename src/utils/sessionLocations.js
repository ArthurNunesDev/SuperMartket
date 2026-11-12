import { isValidLocation } from "./locationSharing.js";

export function applySessionLocationUpdate(currentLocations, userId, location, name) {
  if (!currentLocations || typeof currentLocations !== "object" || typeof userId !== "string" || !userId.trim()) {
    return currentLocations ?? {};
  }

  if (location == null) {
    if (!Object.prototype.hasOwnProperty.call(currentLocations, userId)) return currentLocations;
    const nextLocations = { ...currentLocations };
    delete nextLocations[userId];
    return nextLocations;
  }

  if (!isValidLocation(location)) return currentLocations;

  return {
    ...currentLocations,
    [userId]: {
      ...location,
      name: typeof name === "string" && name.trim() ? name.trim().slice(0, 50) : "Participante",
    },
  };
}
