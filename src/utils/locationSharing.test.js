import test from "node:test";
import assert from "node:assert/strict";
import {
  distanceBetweenLocations,
  isValidLocation,
  normalizeGeolocationPosition,
  shouldPublishLocation,
} from "./locationSharing.js";

const baseLocation = {
  latitude: -20.3155,
  longitude: -40.3128,
  accuracy: 12,
  updatedAt: "2026-11-12T10:00:00.000Z",
};

test("normalizes browser geolocation into a safe presence payload", () => {
  const location = normalizeGeolocationPosition({
    coords: { latitude: -20.3, longitude: -40.2, accuracy: 8.6 },
  }, Date.parse("2026-11-12T10:00:00.000Z"));

  assert.deepEqual(location, {
    latitude: -20.3,
    longitude: -40.2,
    accuracy: 9,
    updatedAt: "2026-11-12T10:00:00.000Z",
  });
});

test("rejects invalid coordinates and malformed timestamps", () => {
  assert.equal(isValidLocation({ ...baseLocation, latitude: 91 }), false);
  assert.equal(isValidLocation({ ...baseLocation, longitude: 181 }), false);
  assert.equal(isValidLocation({ ...baseLocation, updatedAt: "invalid" }), false);
  assert.equal(normalizeGeolocationPosition({ coords: { latitude: NaN, longitude: 0 } }), null);
});

test("calculates distance between geographic coordinates", () => {
  const nearby = { ...baseLocation, latitude: -20.3150 };
  assert.ok(distanceBetweenLocations(baseLocation, nearby) > 50);
  assert.ok(distanceBetweenLocations(baseLocation, baseLocation) < 0.01);
});

test("publishes the first position, then throttles small movements", () => {
  const next = { ...baseLocation, updatedAt: "2026-11-12T10:00:10.000Z" };
  assert.equal(shouldPublishLocation(next, null), true);
  assert.equal(
    shouldPublishLocation(next, baseLocation, Date.parse("2026-11-12T10:00:10.000Z")),
    false,
  );
});

test("publishes when the interval or movement threshold is reached", () => {
  const afterInterval = { ...baseLocation, updatedAt: "2026-11-12T10:00:25.000Z" };
  const moved = { ...baseLocation, latitude: -20.3140, updatedAt: "2026-11-12T10:00:10.000Z" };

  assert.equal(
    shouldPublishLocation(afterInterval, baseLocation, Date.parse("2026-11-12T10:00:25.000Z")),
    true,
  );
  assert.equal(
    shouldPublishLocation(moved, baseLocation, Date.parse("2026-11-12T10:00:10.000Z")),
    true,
  );
});
