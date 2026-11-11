export function groupPresenceByUser(presence = {}) {
  const grouped = new Map();
  Object.values(presence).flat().forEach((entry) => {
    if (!entry?.userId) return;
    const current = grouped.get(entry.userId);
    const priority = (status) => status === "online" ? 2 : status === "inactive" ? 1 : 0;
    if (!current || priority(entry.status) > priority(current.status)) grouped.set(entry.userId, entry);
    else if (entry.lastActiveAt && (!current.lastActiveAt || entry.lastActiveAt > current.lastActiveAt)) {
      grouped.set(entry.userId, { ...current, lastActiveAt: entry.lastActiveAt });
    }
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
