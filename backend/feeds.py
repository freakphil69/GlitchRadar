"""Live deal ingestion from public German deal RSS feeds (mydealz, DealDoktor).

Every item keeps its original source link, so the app always shows where
and when a find was spotted online. Nothing in here is AI-generated.
"""
import asyncio
import html
import logging
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

from http_limits import bounded_get

logger = logging.getLogger(__name__)
MAX_FEED_BYTES = 2 * 1024 * 1024
MAX_FEED_ITEMS = 100
FEED_CONCURRENCY = 2

USER_AGENT = "Mozilla/5.0 (compatible; GlitchRadar/1.0; +https://glitchradar.app)"

# (url, source key, human label, default glitch type or None)
FEEDS = [
    ("https://www.mydealz.de/rss/gruppe/preisfehler", "mydealz", "MYDEALZ · PREISFEHLER", "price_error"),
    ("https://www.mydealz.de/rss/gutscheine", "mydealz", "MYDEALZ · GUTSCHEINE", "coupon"),
    ("https://www.mydealz.de/rss/hot", "mydealz", "MYDEALZ · HOT", None),
    ("https://www.dealdoktor.de/feed/", "dealdoktor", "DEALDOKTOR", None),
    ("https://www.mydealz.de/rss/gruppe/freebies", "mydealz", "MYDEALZ · GRATIS", None),
    ("https://www.preisjaeger.at/rss/gruppe/preisfehler", "preisjaeger", "PREISJÄGER · PREISFEHLER", "price_error"),
    ("https://www.preisjaeger.at/rss/hot", "preisjaeger", "PREISJÄGER · HOT", None),
    ("https://www.mytopdeals.net/feed/", "mytopdeals", "MYTOPDEALS", None),
    ("https://www.sparhamster.at/feed/", "sparhamster", "SPARHAMSTER", None),
    ("https://www.mydealz.de/rss/gruppe/lieferservice", "mydealz", "MYDEALZ · LIEFERDIENSTE", None),
    ("https://www.mydealz.de/rss/gruppe/fast-food", "mydealz", "MYDEALZ · FAST FOOD", None),
]

NS = {
    "pepper": "http://www.pepper.com/rss",
    "media": "http://search.yahoo.com/mrss/",
    "content": "http://purl.org/rss/1.0/modules/content/",
}

TEMP_RE = re.compile(r"^\s*(-?\d{1,5})°\s*-\s*")
NUMBER_RE = (r"(?:\d{1,3}(?:[.\u00a0\u202f ]\d{3})+(?:,\d{1,2})?"
             r"|\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:[.,]\d{1,2})?)")
PRICE_RE = rf"(?<![\d.,])({NUMBER_RE})(?![\d.,])\s*(?:€|EUR|Euro)"
STATT_RE = re.compile(r"(?:statt|UVP|vorher|sonst)\s*(?:ca\.\s*)?" + PRICE_RE, re.I)
FOR_RE = re.compile(r"(?:für|nur|ab|jetzt)\s*(?:nur\s*)?" + PRICE_RE, re.I)
PCT_RE = re.compile(r"(\d{1,2})\s*%")
CODE_RE = re.compile(
    r"(?:Gutschein-?code|Rabatt-?code|Promo-?code|Code|Gutschein)\s*[:„\"']?\s*(?:<strong>)?\s*([A-Z0-9][A-Z0-9\-]{1,19})\b"
)
TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


PARTIAL_TAG_RE = re.compile(r"<[^>]*$")


def _to_text(raw: str) -> str:
    # Feeds sometimes double-escape HTML and cut it mid-tag ("<str..."), so unescape first,
    # strip complete tags, then drop any dangling partial tag at the end.
    text = html.unescape(html.unescape(raw or ""))
    text = TAG_RE.sub(" ", text)
    cut = PARTIAL_TAG_RE.search(text)
    text = PARTIAL_TAG_RE.sub("", text)
    text = WS_RE.sub(" ", text).strip()
    if cut and text and not text.endswith(("…", ".", "!", "?")):
        text += " …"
    return re.sub(r"\s*(\.\.\.|…)$", "…", text) if text.endswith(("...", "…")) else text


def _price(v: Optional[str]) -> Optional[float]:
    if not v:
        return None
    m = re.search(rf"(?<![\d.,]){NUMBER_RE}(?![\d.,])", str(v))
    if not m:
        return None
    try:
        number = re.sub(r"[\u00a0\u202f ]", "", m.group(0))
        if "." in number and "," in number:
            decimal, grouping = (",", ".") if number.rfind(",") > number.rfind(".") else (".", ",")
            number = number.replace(grouping, "").replace(decimal, ".")
        elif "," in number or "." in number:
            sep = "," if "," in number else "."
            if len(number.rsplit(sep, 1)[1]) == 3:
                number = number.replace(sep, "")
            else:
                number = number.replace(sep, ".")
        return float(number)
    except ValueError:
        return None


def _classify(default_type: Optional[str], text: str) -> str:
    t = text.lower()
    if default_type == "price_error" or "preisfehler" in t:
        return "price_error"
    if "cashback" in t:
        return "cashback"
    combinable = re.sub(r"\b(?:nicht|keine?|ohne)\b[^.!?\n]{0,80}\b(?:kombinier\w*|stapel\w*)", "", t)
    if "kombinier" in combinable or "stapel" in combinable or "coupon-kombi" in combinable:
        return "stack"
    if "versandkostenfrei" in t or "gratis versand" in t or "kostenloser versand" in t:
        return "shipping"
    if default_type == "coupon" or "gutschein" in t or "rabattcode" in t:
        return "coupon"
    return "deal"


def _parse_item(it: ET.Element, source: str, label: str, default_type: Optional[str]) -> Optional[dict]:
    title = _to_text(it.findtext("title") or "")
    link = (it.findtext("link") or "").strip()
    if not title or not link or "top-deal-des-tages" in link:
        return None

    temperature = None
    m = TEMP_RE.match(title)
    if m:
        temperature = int(m.group(1))
        title = title[m.end():]

    desc_raw = it.findtext("description") or ""
    content_raw = it.findtext("content:encoded", namespaces=NS) or ""
    desc_text = _to_text(desc_raw)
    full_text = f"{title} {desc_text} {_to_text(content_raw)[:1500]}"

    merchant_el = it.find("pepper:merchant", NS)
    shop = merchant_el.get("name") if merchant_el is not None else None
    price = _price(merchant_el.get("price")) if merchant_el is not None else None
    pct_attr = merchant_el.get("discount") if merchant_el is not None else None
    if not shop:
        sm = re.match(r"^\s*\[?\s*([A-Za-z0-9&.\- ]{2,30}?)\s*\]?\s*[:|]", title)
        shop = sm.group(1).strip() if sm else ({"dealdoktor": "DealDoktor-Fund", "mytopdeals": "myTopDeals-Fund", "sparhamster": "Sparhamster-Fund"}.get(source, "Online-Deal"))

    title_and_desc = f"{title} {desc_text}"
    original = None
    sm = STATT_RE.search(title_and_desc)
    if sm:
        original = _price(sm.group(1))
    if price is None:
        fm = FOR_RE.search(title)
        if fm:
            price = _price(fm.group(1))

    discount = 0
    if price is not None and original and original > price:
        discount = max(0, min(100, round((1 - price / original) * 100)))
    elif pct_attr:
        discount = int(_price(pct_attr) or 0)
    else:
        pm = PCT_RE.search(title)
        if pm:
            discount = int(pm.group(1))

    code = None
    cm = CODE_RE.search(desc_raw) or CODE_RE.search(content_raw)
    if cm and re.search(r"[A-Z]", cm.group(1)) and cm.group(1) not in {"CODE", "GUTSCHEIN"}:
        code = cm.group(1)

    image_el = it.find("media:content", NS)
    image = image_el.get("url") if image_el is not None else None
    if not image:
        im = re.search(r'<img[^>]+src="([^"]+)"', desc_raw + content_raw)
        image = im.group(1) if im else None

    try:
        published = parsedate_to_datetime(it.findtext("pubDate") or "")
        published = published.astimezone(timezone.utc)
    except (TypeError, ValueError):
        published = datetime.now(timezone.utc)

    return {
        "type": _classify(default_type, full_text),
        "title": title[:160],
        "shop": shop[:60],
        "category": (it.findtext("category") or "Sonstiges").strip()[:40],
        "description": desc_text[:600],
        "original_price": original,
        "glitched_price": price,
        "discount_pct": discount,
        "coupon_code": code,
        "product_id": (merchant_el.get("gtin") or merchant_el.get("ean") or merchant_el.get("sku")) if merchant_el is not None else None,
        "url": (merchant_el.get("offerUrl") or merchant_el.get("url")) if merchant_el is not None else None,
        "image_url": image,
        "source": source,
        "source_label": label,
        "source_url": link,
        "temperature": temperature,
        "published_at": published,
    }


async def _fetch(client: httpx.AsyncClient, url: str, source: str, label: str, default_type: Optional[str]) -> list:
    try:
        _, content = await bounded_get(client, url, MAX_FEED_BYTES)
        root = ET.fromstring(content)
    except Exception as e:
        logger.warning(f"Feed {url} fehlgeschlagen: {e}")
        return []
    out = []
    for index, it in enumerate(root.iter("item")):
        if index >= MAX_FEED_ITEMS:
            break
        try:
            parsed = _parse_item(it, source, label, default_type)
        except Exception as e:
            logger.warning(f"Item-Parse-Fehler ({url}): {e}")
            continue
        if parsed:
            out.append(parsed)
    return out


async def fetch_all_feeds() -> tuple[list, int]:
    """Returns (deduplicated items, number of feeds that answered)."""
    slots = asyncio.Semaphore(FEED_CONCURRENCY)
    async with httpx.AsyncClient(timeout=20, follow_redirects=True, headers={"User-Agent": USER_AGENT}) as client:
        async def fetch_one(feed):
            async with slots:
                return await _fetch(client, *feed)
        results = await asyncio.gather(*(fetch_one(feed) for feed in FEEDS))
    seen, items = set(), []
    for batch in results:
        for it in batch:
            if it["source_url"] in seen:
                continue
            seen.add(it["source_url"])
            items.append(it)
    return items, sum(1 for r in results if r)
