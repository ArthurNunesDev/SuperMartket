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