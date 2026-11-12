import test from "node:test";
import assert from "node:assert/strict";
import { applySessionLocationUpdate } from "./sessionLocations.js";

const validLocation = {
  latitude: -20.3155,
  longitude: -40.3128,
  accuracy: 12,
  updatedAt: "2026-11-12T12:00:00.000Z",
};

test("stores a valid location for the matching participant", () => {
  const result = applySessionLocationUpdate({}, "user-1", validLocation, "Arthur");
  assert.deepEqual(result["user-1"], { ...validLocation, name: "Arthur" });
});

test("removes only the participant whose location was stopped", () => {
  const current = {
    "user-1": { ...validLocation, name: "Arthur" },
    "user-2": { ...validLocation, name: "Maria" },
  };
  const result = applySessionLocationUpdate(current, "user-1", null, "Arthur");
  assert.equal(result["user-1"], undefined);
  assert.deepEqual(result["user-2"], current["user-2"]);
});

test("ignores invalid coordinates and malformed participant identifiers", () => {
  const current = { "user-1": { ...validLocation, name: "Arthur" } };
  assert.equal(applySessionLocationUpdate(current, "user-2", { ...validLocation, latitude: 95 }, "Maria"), current);
  assert.equal(applySessionLocationUpdate(current, "", validLocation, "Maria"), current);
});

test("does not mutate the existing location state", () => {
  const current = {};
  const result = applySessionLocationUpdate(current, "user-1", validLocation, "Arthur");
  assert.deepEqual(current, {});
  assert.notEqual(result, current);
});
