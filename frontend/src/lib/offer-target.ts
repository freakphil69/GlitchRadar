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

// A merchant's homepage or search landing is not purchase evidence. With the user's explicit
// confirmation, the app opens the search/homepage as a written path to the exact offer, while
// the copy stays honest that this is not the verified product target.
// The path is created only from the configured shop domains, never from a raw shop
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

const SHOP_SEARCH_URLS: Record<string, (q: string) => string> = {
  amazon: (q) => `https://www.amazon.de/s?k=${q}`,
  "amazon marketplace": (q) => `https://www.amazon.de/s?k=${q}`,
  otto: (q) => `https://www.otto.de/suche/${q}/`,
  mediamarkt: (q) => `https://www.mediamarkt.de/de/search.html?query=${q}`,
  saturn: (q) => `https://www.saturn.de/de/search.html?query=${q}`,
  zalando: (q) => `https://www.zalando.de/katalog/?q=${q}`,
  ebay: (q) => `https://www.ebay.de/sch/i.html?_nkw=${q}`,
  kaufland: (q) => `https://www.kaufland.de/s/?search_value=${q}`,
  lidl: (q) => `https://www.lidl.de/q/search?q=${q}`,
  galaxus: (q) => `https://www.galaxus.de/de/search?q=${q}`,
  notebooksbilliger: (q) => `https://www.notebooksbilliger.de/suche?q=${q}`,
  cyberport: (q) => `https://www.cyberport.de/tools/search?query=${q}`,
  alternate: (q) => `https://www.alternate.de/listing.xhtml?q=${q}`,
  decathlon: (q) => `https://www.decathlon.de/search?Ntt=${q}`,
  dm: (q) => `https://www.dm.de/search?query=${q}`,
  rossmann: (q) => `https://www.rossmann.de/de/search/?text=${q}`,
  douglas: (q) => `https://www.douglas.de/de/search?q=${q}`,
  nike: (q) => `https://www.nike.com/de/w?q=${q}`,
  adidas: (q) => `https://www.adidas.de/search?q=${q}`,
  "about you": (q) => `https://www.aboutyou.de/suche?term=${q}`,
  ikea: (q) => `https://www.ikea.com/de/de/search/?q=${q}`,
};

export function merchantLanding(g: Glitch) {
  return SHOP_HOMEPAGES[(g.shop ?? "").trim().toLowerCase()] ?? null;
}

export function merchantSearchTarget(g: Glitch): string | null {
  const key = (g.shop ?? "").trim().toLowerCase();
  const builder = SHOP_SEARCH_URLS[key];
  const rawTitle = (g.title ?? "").trim().slice(0, 120);
  if (builder && rawTitle) {
    return https(builder(encodeURIComponent(rawTitle)));
  }
  return merchantLanding(g);
}

// Hint shown only when the current target is a search/homepage landing rather than
// the verified product target.
export function homepageClickHint(g: Glitch, now = Date.now()) {
  if (offerTarget(g, now).purchase) return null;
  const search = merchantSearchTarget(g);
  if (!search) return null;
  const isSearch = search !== merchantLanding(g);
  return isSearch
    ? "DIREKTE SUCHE: MIT EINEM KLICK NAH AM ANGEBOT. KEIN VERIFIZIERTER KAUF-LINK."
    : "ZUSÄTZLICHES ANKLICKEN DER STARTSEITE ERFORDERLICH. DAS ANGEBOT MUSS DORT GESUCHT WERDEN.";
}

export function confirmedTarget(g: Glitch, confirm: boolean, now = Date.now()):
  { url: string | null; purchase: boolean; landing: string | null } {
  const primary = offerTarget(g, now);
  if (primary.purchase) return { ...primary, landing: null };
  // Only an explicit user confirmation can make a search/homepage target the action target.
  // The product URL is never used here: a search or landing page is a manual path, not
  // a direct product target that would bypass the server's purchase-link decision.
  const landing = confirm ? (merchantSearchTarget(g) ?? merchantLanding(g)) : null;
  return { ...primary, url: confirm ? primary.url : null, landing };
}
