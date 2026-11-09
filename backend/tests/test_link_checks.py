import asyncio
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from link_checks import check_product_link, page_matches, purchase_link_allowed


def page(price="50.00", availability="InStock", sku="exact-black", disabled=False):
    data = {"@context": "https://schema.org", "@type": "Product", "sku": sku,
            "offers": {"@type": "Offer", "price": price, "priceCurrency": "EUR",
                       "availability": "https://schema.org/" + availability}}
    return '<script type="application/ld+json">' + json.dumps(data) + '</script><button' + (
        " disabled" if disabled else "") + ">In den Warenkorb</button>"


@pytest.mark.parametrize("html,identity,price,expected", [
    (page(), "exact-black", 50, True),
    (page(), "wrong-blue", 50, False),
    (page(price="51.00"), "exact-black", 50, False),
    (page(availability="OutOfStock"), "exact-black", 50, False),
    (page(disabled=True), "exact-black", 50, False),
    ('<div hidden>' + page() + '</div>', "exact-black", 50, False),
    (page().replace("In den Warenkorb", "Nicht in den Warenkorb legbar"), "exact-black", 50, False),
    (page() + page(sku="other-model"), "exact-black", 50, False),
    (page(), None, 50, False),
    ("<h1>Access Denied</h1>", "exact-black", 50, False),
    ("<h1>Shop-Startseite</h1>", "exact-black", 50, False),
])
def test_sale_page_evidence(html, identity, price, expected):
    assert page_matches(html, identity, price, "EUR") is expected


def test_proof_is_bound_to_exact_offer_and_short_lifetime():
    now = datetime.now(timezone.utc)
    fields = dict(url="https://shop.example/product", title="Exact model", product_id="sku",
                  price=50, currency="EUR")
    proof = dict(**fields, passed=True, checked_at=now.isoformat())
    assert purchase_link_allowed(proof, **fields, now=now)
    for patch in [{"url": fields["url"] + "?variant=other"}, {"price": 49},
                  {"title": "Other model"}, {"product_id": "other"}, {"currency": "USD"}]:
        assert not purchase_link_allowed(proof, **{**fields, **patch}, now=now)
    for age in [timedelta(minutes=16), timedelta(seconds=-1)]:
        assert not purchase_link_allowed({**proof, "checked_at": (now-age).isoformat()}, **fields, now=now)
    assert not purchase_link_allowed({**proof, "checked_at": "invalid"}, **fields, now=now)
    assert not purchase_link_allowed({**proof, "checked_at": now.replace(tzinfo=None).isoformat()}, **fields, now=now)


def test_backcheck_fails_after_page_changes_and_rejects_unsafe_redirects():
    async def run():
        requests = []
        response_body = page()

        def respond(request):
            requests.append(str(request.url))
            if request.url.path == "/redirect":
                return httpx.Response(302, headers={"location": "http://127.0.0.1/secret"})
            return httpx.Response(200, text=response_body, headers={"content-type": "text/html"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            args = dict(title="Exact model", product_id="exact-black", price=50,
                        currency="EUR", allowed_hosts={"shop.example"})
            first = await check_product_link(client, url="https://shop.example/product", **args)
            assert first["passed"]
            response_body = "<h1>Produkt nicht mehr verfügbar</h1>"
            second = await check_product_link(client, url="https://shop.example/product", **args)
            assert not second["passed"]
            assert not (await check_product_link(client, url="https://shop.example/redirect", **args))["passed"]
            assert not any("127.0.0.1" in url for url in requests)
            assert not (await check_product_link(client, url="https://shop.example/", **args))["passed"]

    asyncio.run(run())
