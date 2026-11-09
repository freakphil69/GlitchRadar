"""Conservative purchase-link checks. Missing evidence is never a pass."""
import json
import re
from datetime import datetime, timedelta, timezone
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

import httpx

from http_limits import bounded_get

CHECK_TTL = timedelta(minutes=15)
MAX_PAGE_BYTES = 2 * 1024 * 1024


class SalePage(HTMLParser):
    def __init__(self):
        super().__init__()
        self.scripts = []
        self.buttons = []
        self._script = None
        self._button = None
        self._tags = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        hidden = (bool(self._tags and self._tags[-1][1])
                  or "hidden" in attrs or attrs.get("aria-hidden") == "true"
                  or bool(re.search(r"display\s*:\s*none|visibility\s*:\s*hidden", attrs.get("style", ""), re.I)))
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self._tags.append((tag, hidden))
        if tag == "script" and attrs.get("type", "").lower() == "application/ld+json":
            self._script = []
        if ((tag in {"button", "a"} or attrs.get("role") == "button")
                and not hidden and "disabled" not in attrs
                and attrs.get("aria-disabled") != "true" and attrs.get("aria-hidden") != "true"
                and not re.search(r"display\s*:\s*none", attrs.get("style", ""))):
            self._button = (tag, [])

    def handle_data(self, data):
        if self._script is not None:
            self._script.append(data)
        if self._button is not None:
            self._button[1].append(data)

    def handle_endtag(self, tag):
        for i in range(len(self._tags) - 1, -1, -1):
            if self._tags[i][0] == tag:
                del self._tags[i:]
                break
        if tag == "script" and self._script is not None:
            self.scripts.append("".join(self._script))
            self._script = None
        if self._button is not None and tag == self._button[0]:
            self.buttons.append(" ".join(self._button[1]))
            self._button = None


def _nodes(value):
    if isinstance(value, list):
        for item in value:
            yield from _nodes(item)
    elif isinstance(value, dict):
        yield value
        for item in value.values():
            if isinstance(item, (dict, list)):
                yield from _nodes(item)


def _is_type(node, kind):
    value = node.get("@type", [])
    return kind in (value if isinstance(value, list) else [value])


def page_matches(html, product_id, price, currency):
    """Only exact SKU/GTIN, one matching Offer and a purchase action can pass.

    A title similarity score, HTTP 200, AggregateOffer/from-price, or a stock
    statement alone is insufficient. JS-only/bot-blocked shops remain unverified.
    """
    if not product_id or price is None:
        return False
    page = SalePage()
    page.feed(html)
    if not any(re.search(r"in den warenkorb|jetzt kaufen|add to (?:bag|cart)|buy now", b, re.I)
               and not re.search(r"\b(?:nicht|not|unavailable|ausverkauft)\b|sold out", b, re.I)
               for b in page.buttons):
        return False
    products = []
    try:
        for script in page.scripts:
            products.extend(n for n in _nodes(json.loads(script)) if _is_type(n, "Product"))
    except (ValueError, TypeError, RecursionError):
        return False
    # A recommendation/listing containing the expected SKU is not sufficient.
    # Reject ambiguity rather than borrowing another product's buy button.
    if len(products) != 1:
        return False
    for script in page.scripts:
        try:
            nodes = _nodes(json.loads(script))
            for product in nodes:
                if not _is_type(product, "Product"):
                    continue
                ids = {str(product[k]) for k in ("sku", "gtin", "gtin8", "gtin12", "gtin13", "gtin14", "mpn")
                       if product.get(k) is not None}
                if str(product_id) not in ids:
                    continue
                offers = product.get("offers", [])
                if isinstance(offers, list) and len(offers) != 1:
                    continue
                for offer in offers if isinstance(offers, list) else [offers]:
                    if not isinstance(offer, dict) or not _is_type(offer, "Offer"):
                        continue
                    if offer.get("sku") is not None and str(offer["sku"]) != str(product_id):
                        continue
                    today = datetime.now(timezone.utc).date()
                    if offer.get("priceValidUntil"):
                        try:
                            if datetime.fromisoformat(offer["priceValidUntil"].replace("Z", "+00:00")).date() < today:
                                continue
                        except (ValueError, TypeError, AttributeError):
                            continue
                    try:
                        actual = float(offer.get("price"))
                    except (TypeError, ValueError):
                        continue
                    if (abs(actual - price) <= 0.005 and offer.get("priceCurrency") == currency
                            and offer.get("availability") in {"https://schema.org/InStock", "http://schema.org/InStock"}):
                        return True
        except (ValueError, TypeError, RecursionError):
            continue
    return False


def purchase_link_allowed(check, *, url, title, product_id, price, currency, now):
    if not isinstance(check, dict) or check.get("passed") is not True:
        return False
    try:
        stamp = datetime.fromisoformat(str(check["checked_at"]).replace("Z", "+00:00"))
        age = now - stamp
        return (stamp.tzinfo is not None and timedelta(0) <= age <= CHECK_TTL
                and check.get("url") == url and check.get("title") == title
                and product_id is not None and check.get("product_id") == product_id
                and price is not None and check.get("price") == price
                and check.get("currency") == currency)
    except (KeyError, ValueError, TypeError, OverflowError):
        return False


async def check_product_link(client, *, url, title, product_id, price, currency, allowed_hosts):
    proof = dict(url=url, title=title, product_id=product_id, price=price, currency=currency,
                 checked_at=datetime.now(timezone.utc).isoformat(), passed=False)
    target = url
    if not product_id or price is None:
        return {**proof, "reason": "Produktkennung oder eindeutiger Preis fehlt"}
    try:
        for _ in range(6):
            parsed = urlsplit(target)
            host = (parsed.hostname or "").lower().removeprefix("www.")
            if (parsed.scheme != "https" or parsed.username or parsed.password
                    or parsed.port not in {None, 443} or host not in allowed_hosts
                    or parsed.path in {"", "/"}):
                return {**proof, "reason": "Ziel ist keine freigegebene HTTPS-Produktadresse"}
            try:
                headers, body = await bounded_get(client, target, MAX_PAGE_BYTES, follow_redirects=False)
            except httpx.HTTPStatusError as error:
                if error.response.status_code in {301, 302, 303, 307, 308} and error.response.headers.get("location"):
                    target = urljoin(target, error.response.headers["location"])
                    continue
                raise
            if "text/html" not in headers.get("content-type", ""):
                return {**proof, "reason": "Keine HTML-Verkaufsseite"}
            passed = page_matches(body.decode("utf-8", errors="replace"), product_id, price, currency)
            return {**proof, "final_url": target, "passed": passed,
                    "reason": "Produkt, Preis, Bestand und Kaufaktion belegt" if passed else "Kaufnachweis unvollständig oder widersprüchlich"}
        return {**proof, "reason": "Zu viele Weiterleitungen"}
    except (httpx.HTTPError, ValueError, RecursionError):
        return {**proof, "reason": "Prüfung technisch nicht abschließbar"}
