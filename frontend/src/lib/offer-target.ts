import type { Glitch, OfferLinkProof } from "./types";

function https(url: string | null | undefined): string | null {
  try {
    const parsed = new URL(url ?? "");
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed.href : null;
  } catch {
    return null;
  }
}

// Defense in depth for stale query/stash data. The server is authoritative;
// an old affiliate URL must never bypass its current purchase-link decision.
export function offerTarget(g: Glitch, now = Date.now()) {
  const matches = (proof: OfferLinkProof | null | undefined, url: string | null) => {
    const age = now - Date.parse(proof?.checked_at ?? "");
    return Number.isFinite(age) && age >= 0 && age <= 15 * 60_000
      && proof?.passed === true && !!g.product_id && proof.product_id === g.product_id
      && proof.url === url && proof.title === g.title && proof.price === g.glitched_price
      && proof.currency === g.currency;
  };
  const allowed = g.status === "active" && !g.price_conflict && g.link_status === "checked"
    && matches(g.link_check, g.url)
    && (!g.expires_at || Date.parse(g.expires_at) > now);
  const merchant = allowed && https(g.url);
  return merchant
    ? { url: matches(g.affiliate_check, g.affiliate_url) ? https(g.affiliate_url) ?? merchant : merchant, purchase: true }
    : { url: https(g.source_url), purchase: false };
}
