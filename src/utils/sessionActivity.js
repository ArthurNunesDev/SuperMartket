export function groupPresenceByUser(presence = {}) {
  const grouped = new Map();
  Object.values(presence).flat().forEach((entry) => {
    if (!entry?.userId) return;

    const current = grouped.get(entry.userId);
    if (!current) {
      grouped.set(entry.userId, entry);
      return;
    }

    const priority = (status) => status === "online" ? 2 : status === "inactive" ? 1 : 0;
    const currentActivityTime = Date.parse(current.lastActiveAt ?? "");
    const nextActivityTime = Date.parse(entry.lastActiveAt ?? "");
    const preferred = priority(entry.status) > priority(current.status)
      || (priority(entry.status) === priority(current.status)
        && Number.isFinite(nextActivityTime)
        && (!Number.isFinite(currentActivityTime) || nextActivityTime > currentActivityTime))
      ? entry
      : current;

    const currentLocationTime = Date.parse(current.location?.updatedAt ?? "");
    const nextLocationTime = Date.parse(entry.location?.updatedAt ?? "");
    const latestLocation = entry.location && (
      !current.location || nextLocationTime >= currentLocationTime
    ) ? entry.location : current.location;

    grouped.set(entry.userId, {
      ...preferred,
      location: latestLocation ?? null,
    });
  });
  return grouped;
}

export function getPresenceStatus(memberId, presenceByUser) {
  return presenceByUser.get(memberId)?.status ?? "offline";
}

export function formatInactiveDuration(lastActiveAt, now = Date.now()) {
  const timestamp = Date.parse(lastActiveAt ?? "");
  if (!Number.isFinite(timestamp)) return "Inativo";
  const elapsedSeconds = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (elapsedSeconds < 60) return "Inativo há menos de 1 minuto";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `Inativo há ${minutes} min`;
  return `Inativo há ${Math.floor(minutes / 60)} h`;
}
