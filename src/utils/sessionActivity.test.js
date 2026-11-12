import test from "node:test";
import assert from "node:assert/strict";
import { formatInactiveDuration, getPresenceStatus, groupPresenceByUser } from "./sessionActivity.js";

test("groups tabs by user and prefers an online tab", () => {
  const grouped = groupPresenceByUser({
    tabA: [{ userId: "user-1", status: "inactive", lastActiveAt: "2026-11-11T10:00:00Z" }],
    tabB: [{ userId: "user-1", status: "online", lastActiveAt: "2026-11-11T10:01:00Z" }],
  });
  assert.equal(grouped.get("user-1").status, "online");
  assert.equal(getPresenceStatus("user-1", grouped), "online");
});

test("marks a member without presence as offline", () => {
  assert.equal(getPresenceStatus("user-2", new Map()), "offline");
});

test("formats inactive time without negative durations", () => {
  assert.equal(formatInactiveDuration("2026-11-11T10:00:00Z", Date.parse("2026-11-11T10:00:45Z")), "Inativo há menos de 1 minuto");
  assert.equal(formatInactiveDuration("2026-11-11T10:00:00Z", Date.parse("2026-11-11T10:04:00Z")), "Inativo há 4 min");
  assert.equal(formatInactiveDuration(null), "Inativo");
});


test("preserves the latest shared location when grouping multiple tabs", () => {
  const location = {
    latitude: -20.3,
    longitude: -40.2,
    accuracy: 15,
    updatedAt: "2026-11-12T10:02:00.000Z",
  };
  const grouped = groupPresenceByUser({
    tabWithoutLocation: [{ userId: "user-1", status: "online", lastActiveAt: "2026-11-12T10:03:00Z" }],
    tabSharingLocation: [{ userId: "user-1", status: "online", lastActiveAt: "2026-11-12T10:01:00Z", location }],
  });

  assert.deepEqual(grouped.get("user-1").location, location);
  assert.equal(grouped.get("user-1").lastActiveAt, "2026-11-12T10:03:00Z");
});
