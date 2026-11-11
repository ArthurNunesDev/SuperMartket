export function calculateItemSubtotal(quantityMilli, unitPriceCents) {
  return Math.round((quantityMilli * unitPriceCents) / 1000);
}

export function calculatePurchaseTotal(items = []) {
  return items.reduce(
    (total, item) => total + calculateItemSubtotal(item.quantityMilli, item.unitPriceCents),
    0
  );
}

export function parseQuantity(value) {
  const normalized = String(value).trim().replace(",", ".");
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) return null;

  const quantity = Number(normalized);
  if (!Number.isFinite(quantity) || quantity <= 0) return null;

  return Math.round(quantity * 1000);
}

export function formatQuantity(quantityMilli) {
  return (quantityMilli / 1000).toLocaleString("pt-BR", {
    maximumFractionDigits: 3,
  });
}

export function sanitizeQuantityInput(value) {
  const normalized = String(value).replace(/[^0-9,.]/g, "").replace(/\./g, ",");
  const separatorIndex = normalized.indexOf(",");
  if (separatorIndex === -1) return normalized;

  const integerPart = normalized.slice(0, separatorIndex);
  const decimalPart = normalized.slice(separatorIndex + 1).replace(/,/g, "").slice(0, 3);
  return `${integerPart},${decimalPart}`;
}
