const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(amountInCents) {
  return currencyFormatter.format(amountInCents / 100);
}

export function parseCurrency(value) {
  let normalized = String(value).trim().replace(/\s|R\$/gi, "");
  if (!normalized) return null;

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;

  return Math.round(amount * 100);
}

export function sanitizeCurrencyInput(value) {
  let normalized = String(value).replace(/[^0-9,.]/g, "");

  if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "");
  } else {
    normalized = normalized.replace(/\./g, ",");
  }

  const separatorIndex = normalized.indexOf(",");
  if (separatorIndex === -1) return normalized;

  const integerPart = normalized.slice(0, separatorIndex);
  const decimalPart = normalized.slice(separatorIndex + 1).replace(/,/g, "").slice(0, 2);
  return `${integerPart},${decimalPart}`;
}
