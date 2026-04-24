const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "\u20ac",
  GBP: "\u00a3",
  JPY: "\u00a5",
  CAD: "C$",
  AUD: "A$",
};

export function formatCurrency(amount: number, currency: string = "USD"): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency + " ";
  const formatted = Math.abs(amount).toFixed(2);
  const sign = amount < 0 ? "-" : "";
  return `${sign}${symbol}${formatted}`;
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 1) + "\u2026";
}
