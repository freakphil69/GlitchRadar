type Price = { price: number; currencyCode: string };

// Compare regular store prices only. This is not a time-limited promotion.
export function annualSavingPercent(annual?: Price, monthly?: Price): number | null {
  if (
    !annual || !monthly ||
    !annual.currencyCode || annual.currencyCode !== monthly.currencyCode ||
    !Number.isFinite(annual.price) || !Number.isFinite(monthly.price) ||
    annual.price <= 0 || monthly.price <= 0
  ) return null;

  const percent = Math.round((1 - annual.price / (monthly.price * 12)) * 100);
  return percent > 0 && percent < 100 ? percent : null;
}
