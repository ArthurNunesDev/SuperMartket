import test from "node:test";
import assert from "node:assert/strict";
import { getSpiderfiedPositions } from "./mapMarkers.js";

test("keeps isolated markers at their original screen positions", () => {
  const points = [{ x: 10, y: 20 }, { x: 200, y: 220 }];
  assert.deepEqual(getSpiderfiedPositions(points), points);
});

test("separates markers at the same position without changing their source points", () => {
  const points = [{ x: 50, y: 50 }, { x: 50, y: 50 }];
  const result = getSpiderfiedPositions(points);

  assert.equal(result.length, 2);
  assert.ok(Math.hypot(result[0].x - result[1].x, result[0].y - result[1].y) >= 60);
  assert.deepEqual(points, [{ x: 50, y: 50 }, { x: 50, y: 50 }]);
});

test("groups nearby markers transitively and preserves input order", () => {
  const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 0 }, { x: 300, y: 300 }];
  const result = getSpiderfiedPositions(points);

  assert.equal(result.length, points.length);
  assert.deepEqual(result[3], points[3]);
  assert.notDeepEqual(result[0], points[0]);
  assert.notDeepEqual(result[1], points[1]);
  assert.notDeepEqual(result[2], points[2]);
});
