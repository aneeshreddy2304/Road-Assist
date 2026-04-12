export function formatCurrencyUSD(value) {
  const numericValue = Number(value ?? 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(numericValue);
}

export function formatMilesFromKm(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "Not calculated";
  return `${(numericValue * 0.621371).toFixed(1)} mi`;
}
