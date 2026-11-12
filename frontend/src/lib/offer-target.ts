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

// A merchant's homepage landing is not purchase evidence. With the user's explicit
// confirmation, the app opens the homepage as a written path to the exact offer, while
// the copy stays honest that this is not the verified product target.
// The path is created only from the configured shop homepage, never from a raw shop
// string that could become an arbitrary domain.
const SHOP_HOMEPAGES: Record<string, string> = {
  zalando: "https://www.zalando.de/",
  mediamarkt: "https://www.mediamarkt.de/",
  saturn: "https://www.saturn.de/",
  otto: "https://www.otto.de/",
  decathlon: "https://www.decathlon.de/",
  amazon: "https://www.amazon.de/",
  "amazon marketplace": "https://www.amazon.de/",
  "about you": "https://www.aboutyou.de/",
  ikea: "https://www.ikea.com/de/de/",
  lieferando: "https://www.lieferando.de/",
  nike: "https://www.nike.com/de/",
  adidas: "https://www.adidas.de/",
  rossmann: "https://www.rossmann.de/",
  dm: "https://www.dm.de/",
  douglas: "https://www.douglas.de/",
  lidl: "https://www.lidl.de/",
  kaufland: "https://www.kaufland.de/",
  ebay: "https://www.ebay.de/",
  notebooksbilliger: "https://www.notebooksbilliger.de/",
  cyberport: "https://www.cyberport.de/",
  alternate: "https://www.alternate.de/",
  galaxus: "https://www.galaxus.de/",
  "google store": "https://store.google.com/de/",
  apple: "https://www.apple.com/de/",
};

export function merchantLanding(g: Glitch) {
  return SHOP_HOMEPAGES[(g.shop ?? "").trim().toLowerCase()] ?? null;
}

// Number of additional clicks from the homepage to the exact offer, only shown when
// the current target is a homepage landing rather than the verified product target.
export function homepageClickHint(g: Glitch, now = Date.now()) {
  if (offerTarget(g, now).purchase) return null;
  return merchantLanding(g) ? "ZUSÄTZLICHES ANKLICKEN DER STARTSEITE ERFORDERLICH. DAS ANGEBOT MUSS DORT GESUCHT WERDEN." : null;
}

export function confirmedTarget(g: Glitch, confirm: boolean, now = Date.now()):
  { url: string | null; purchase: boolean; landing: string | null } {
  const primary = offerTarget(g, now);
  if (primary.purchase) return { ...primary, landing: null };
  // Only an explicit user confirmation can make a homepage target the action target.
  // The product URL is never used here: a landing page is a manual search path, not
  // a direct product target that would bypass the server's purchase-link decision.
  return { ...primary, url: confirm ? primary.url : null, landing: confirm ? merchantLanding(g) : null };
}
