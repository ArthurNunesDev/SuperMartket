export function getSpiderfiedPositions(points, minimumDistance = 44, markerSpacing = 42) {
  if (!Array.isArray(points)) return [];

  const validPoints = points.map((point) => ({
    x: Number.isFinite(point?.x) ? point.x : 0,
    y: Number.isFinite(point?.y) ? point.y : 0,
  }));
  const parents = validPoints.map((_, index) => index);

  const find = (index) => {
    let root = index;
    while (parents[root] !== root) root = parents[root];
    while (parents[index] !== index) {
      const next = parents[index];
      parents[index] = root;
      index = next;
    }
    return root;
  };

  const union = (first, second) => {
    const firstRoot = find(first);
    const secondRoot = find(second);
    if (firstRoot !== secondRoot) parents[secondRoot] = firstRoot;
  };

  for (let first = 0; first < validPoints.length; first += 1) {
    for (let second = first + 1; second < validPoints.length; second += 1) {
      const deltaX = validPoints[first].x - validPoints[second].x;
      const deltaY = validPoints[first].y - validPoints[second].y;
      if (Math.hypot(deltaX, deltaY) < minimumDistance) union(first, second);
    }
  }

  const groups = new Map();
  validPoints.forEach((point, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push({ ...point, index });
    groups.set(root, group);
  });

  const result = [...validPoints];
  groups.forEach((group) => {
    if (group.length < 2) return;

    const center = group.reduce((sum, point) => ({
      x: sum.x + point.x / group.length,
      y: sum.y + point.y / group.length,
    }), { x: 0, y: 0 });
    const radius = Math.max(34, (group.length * markerSpacing) / (2 * Math.PI));

    group.forEach((point, position) => {
      const angle = (-Math.PI / 2) + ((2 * Math.PI * position) / group.length);
      result[point.index] = {
        x: center.x + Math.cos(angle) * radius,
        y: center.y + Math.sin(angle) * radius,
      };
    });
  });

  return result;
}
