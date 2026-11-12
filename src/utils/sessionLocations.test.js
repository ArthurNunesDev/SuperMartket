import test from "node:test";
import assert from "node:assert/strict";
import { applySessionLocationUpdate, getLatestSessionLocation } from "./sessionLocations.js";

const firstLocation = {
  latitude: -20.3155,
  longitude: -40.3128,
  accuracy: 12,
  updatedAt: "2026-11-12T12:00:00.000Z",
};
const secondLocation = {
  ...firstLocation,
  latitude: -20.32,
  updatedAt: "2026-11-12T12:00:10.000Z",
};

test("stores a valid location for the matching participant and tab", () => {
  const result = applySessionLocationUpdate({}, "user-1", firstLocation, "Arthur", "tab-1");
  assert.deepEqual(result["user-1"].tabs["tab-1"], firstLocation);
  assert.equal(result["user-1"].name, "Arthur");
});

test("stopping one tab preserves another tab's location", () => {
  const withTwoTabs = applySessionLocationUpdate(
    applySessionLocationUpdate({}, "user-1", firstLocation, "Arthur", "tab-1"),
    "user-1", secondLocation, "Arthur", "tab-2",
  );
  const result = applySessionLocationUpdate(withTwoTabs, "user-1", null, "Arthur", "tab-1");
  assert.equal(result["user-1"].tabs["tab-1"], undefined);
  assert.deepEqual(result["user-1"].tabs["tab-2"], secondLocation);
});

test("removes only the participant whose final tab stopped sharing", () => {
  const current = applySessionLocationUpdate({}, "user-1", firstLocation, "Arthur", "tab-1");
  const result = applySessionLocationUpdate(current, "user-1", null, "Arthur", "tab-1");
  assert.equal(result["user-1"], undefined);
});

test("selects the newest valid location across participant tabs", () => {
  const current = applySessionLocationUpdate(
    applySessionLocationUpdate({}, "user-1", firstLocation, "Arthur", "tab-1"),
    "user-1", secondLocation, "Arthur", "tab-2",
  );
  assert.deepEqual(getLatestSessionLocation(current["user-1"]), secondLocation);
});

test("ignores invalid coordinates and malformed identifiers", () => {
  const current = applySessionLocationUpdate({}, "user-1", firstLocation, "Arthur", "tab-1");
  assert.equal(applySessionLocationUpdate(current, "user-2", { ...firstLocation, latitude: 95 }, "Maria", "tab-1"), current);
  assert.equal(applySessionLocationUpdate(current, "", firstLocation, "Maria", "tab-1"), current);
});

test("does not mutate the existing location state", () => {
  const current = {};
  const result = applySessionLocationUpdate(current, "user-1", firstLocation, "Arthur", "tab-1");
  assert.deepEqual(current, {});
  assert.notEqual(result, current);
});
