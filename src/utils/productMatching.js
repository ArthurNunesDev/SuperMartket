export function normalizeProductName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function damerauLevenshtein(first, second) {
  const rows = first.length + 1;
  const columns = second.length + 1;
  const distance = Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => row === 0 ? column : column === 0 ? row : 0)
  );

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      distance[row][column] = Math.min(
        distance[row - 1][column] + 1,
        distance[row][column - 1] + 1,
        distance[row - 1][column - 1] + cost
      );
      if (
        row > 1 && column > 1 &&
        first[row - 1] === second[column - 2] &&
        first[row - 2] === second[column - 1]
      ) {
        distance[row][column] = Math.min(distance[row][column], distance[row - 2][column - 2] + cost);
      }
    }
  }
  return distance[first.length][second.length];
}

export function productNameSimilarity(firstValue, secondValue) {
  const first = normalizeProductName(firstValue);
  const second = normalizeProductName(secondValue);
  if (!first || !second) return 0;
  if (first === second) return 1;

  const firstTokens = first.split(" ").sort();
  const secondTokens = second.split(" ").sort();
  if (firstTokens.length > 1 && firstTokens.join(" ") === secondTokens.join(" ")) return 1;
  if (Math.min(first.length, second.length) < 4) return 0;

  const distance = damerauLevenshtein(first, second);
  return 1 - distance / Math.max(first.length, second.length);
}

export function findDuplicateProduct(items, name, excludeId = null) {
  const normalizedName = normalizeProductName(name);
  if (!normalizedName) return null;

  let bestMatch = null;
  let bestScore = 0.79;
  for (const item of items ?? []) {
    if (!item?.name || (excludeId && item.id === excludeId)) continue;
    const score = productNameSimilarity(normalizedName, item.name);
    if (score > bestScore) {
      bestMatch = item;
      bestScore = score;
    }
  }
  return bestMatch ? { item: bestMatch, score: bestScore } : null;
}

export function getFrequentProducts(purchases, limit = 5) {
  const products = new Map();
  for (const purchase of purchases ?? []) {
    if (purchase.status !== "completed") continue;
    const seenInPurchase = new Set();
    for (const item of purchase.items ?? []) {
      const key = normalizeProductName(item.name);
      if (!key) continue;
      const entry = products.get(key) ?? {
        name: item.name,
        count: 0,
        quantityMilli: item.quantityMilli,
        lastSeen: purchase.completedAt ?? purchase.createdAt ?? "",
      };
      if (!seenInPurchase.has(key)) {
        entry.count += 1;
        seenInPurchase.add(key);
      }
      const seenAt = purchase.completedAt ?? purchase.createdAt ?? "";
      if (seenAt >= entry.lastSeen) {
        entry.name = item.name;
        entry.quantityMilli = item.quantityMilli;
        entry.lastSeen = seenAt;
      }
      products.set(key, entry);
    }
  }
  return [...products.values()]
    .filter((item) => item.count > 1)
    .sort((first, second) => second.count - first.count || second.lastSeen.localeCompare(first.lastSeen))
    .slice(0, limit);
}
