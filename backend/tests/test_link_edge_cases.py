"""100 deterministic cases against the production checker, no live HTTP or paid AI."""
import html
import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from link_checks import page_matches, purchase_link_allowed

URL_CASES = [
    ('', False),
    ('#', False),
    ('#cart', False),
    ('javascript:void(0)', False),
    ('http://shop.example/cart', False),
    ('ftp://shop.example/cart', False),
    ('data:text/html,test', False),
    ('mailto:a@example.com', False),
    ('//shop.example/cart', False),
    ('/cart', True),
    ('cart/add', True),
    ('../cart', True),
    ('https://shop.example/cart', True),
    ('HTTPS://shop.example/cart', True),
    (' https://shop.example/cart ', True),
    ('https://[broken/cart', False),
    ('https://[not-an-ip]/cart', False),
    ('https://]/cart', False),
    ('https://[::1/cart', False),
    ('https://[::gg]/cart', False),
    ('https://', False),
    ('https:///cart', False),
    ('https:cart', False),
    ('https://user:pass@shop.example/cart', False),
    ('https://shop.example:bad/cart', False),
    ('https://shop.example:99999/cart', False),
    ('https://shop.example:443/cart', True),
    ('https://shop.example:80/cart', False),
    ('https://shop.example/cart?x=1', True),
    ('https://shop.example/cart#add', True),
    ('https://shop.example/a%20b', True),
    ('/cart?sku=exact', True),
    ('https://shop.example/cart\n', False),
    ('https://shop.example/\tcart', False),
    ('https://shop example/cart', False),
    ('https://127.0.0.1/cart', False),
    ('https://[::1]/cart', False),
    ('https://shop.example\\@evil.example/cart', False),
    ('https://shop.example/cart?next=ok', True),
    ('/cart/add#exact', True),
]

ACTION_CASES = [
    ('<button>In den Warenkorb</button>', True),
    ('<button disabled>In den Warenkorb</button>', False),
    ('<button disabled="false">In den Warenkorb</button>', False),
    ('<button aria-disabled="true">In den Warenkorb</button>', False),
    ('<button hidden>In den Warenkorb</button>', False),
    ('<button aria-hidden="true">In den Warenkorb</button>', False),
    ('<button style="display:none">In den Warenkorb</button>', False),
    ('<div hidden><button>In den Warenkorb</button></div>', False),
    ('<button><span hidden>In den Warenkorb</span>Info</button>', False),
    ('<button><span aria-hidden="true">In den Warenkorb</span>Info</button>', False),
    ('<button><span style="visibility:hidden">In den Warenkorb</span>Info</button>', False),
    ('<button><span>In den Warenkorb</span></button>', True),
    ('<button>Jetzt kaufen</button>', True),
    ('<button>Add to cart</button>', True),
    ('<button>Buy now</button>', True),
    ('<button>Nicht in den Warenkorb</button>', False),
    ('<button>Not available: buy now</button>', False),
    ('<button>Ausverkauft: Jetzt kaufen</button>', False),
    ('<button>Sold out: buy now</button>', False),
    ('<fieldset disabled><button>In den Warenkorb</button></fieldset>', False),
    ('<div inert><button>In den Warenkorb</button></div>', False),
    ('<template><button>In den Warenkorb</button></template>', False),
    ('<button style="visibility:collapse">In den Warenkorb</button>', False),
    ('<button aria-disabled="TRUE">In den Warenkorb</button>', False),
    ('<button aria-hidden="TRUE">In den Warenkorb</button>', False),
    ('<div role="button">In den Warenkorb</div>', False),
    ('<button>Aktuell nicht verfügbar</button>', False),
    ('<button>Mehr erfahren</button>', False),
    ('<button>In den <span>Warenkorb</span></button>', True),
    ('<button><span hidden>Info</span>In den Warenkorb</button>', True),
]

PRODUCT_CASES = [
    ({}, True),
    ({'sku': 'other'}, False),
    ({'offers.price': '51'}, False),
    ({'offers.priceCurrency': 'USD'}, False),
    ({'offers.availability': 'https://schema.org/OutOfStock'}, False),
    ({'offers.price': None}, False),
    ({'offers.price': 'NaN'}, False),
    ({'offers.price': 'Infinity'}, False),
    ({'offers.@type': 'AggregateOffer'}, False),
    ({'offers.priceValidUntil': '2000-01-01'}, False),
    ({'offers.priceValidUntil': 'not-a-date'}, False),
    ({'offers': None}, False),
    ({'offers': 'malformed'}, False),
    ({'offers.price': True}, False),
    ({'offers.sku': 'other'}, False),
]

PROOF_CASES = [
    ({}, True),
    ({'passed': False}, False),
    ({'passed': 1}, False),
    ({'age': 901}, False),
    ({'age': 900}, True),
    ({'age': -1}, False),
    ({'checked_at': 'bad'}, False),
    ({'checked_at': None}, False),
    ({'url': 'https://shop.example/other'}, False),
    ({'title': 'other'}, False),
    ({'product_id': 'other'}, False),
    ({'price': 49}, False),
    ({'currency': 'USD'}, False),
    ({'age': 899}, True),
    ({'checked_at': '2026-11-09T12:00:00'}, False),
]

def product_page(action, patch=None):
    product = {"@type": "Product", "sku": "exact", "offers": {
        "@type": "Offer", "price": "50.00", "priceCurrency": "EUR",
        "availability": "https://schema.org/InStock"}}
    for key, value in (patch or {}).items():
        if "." in key:
            root, leaf = key.split(".", 1)
            product[root][leaf] = value
        else:
            product[key] = value
    return '<script type="application/ld+json">' + json.dumps(product) + '</script>' + action


@pytest.mark.parametrize("href,expected", URL_CASES, ids=[f"url_{i:02d}" for i in range(40)])
def test_action_urls(href, expected):
    action = '<a href="' + html.escape(href, quote=True) + '">In den Warenkorb</a>'
    assert page_matches(product_page(action), "exact", 50, "EUR") is expected


@pytest.mark.parametrize("action,expected", ACTION_CASES, ids=[f"action_{i:02d}" for i in range(30)])
def test_action_visibility(action, expected):
    assert page_matches(product_page(action), "exact", 50, "EUR") is expected


@pytest.mark.parametrize("patch,expected", PRODUCT_CASES, ids=[f"product_{i:02d}" for i in range(15)])
def test_product_evidence(patch, expected):
    assert page_matches(product_page('<button>In den Warenkorb</button>', patch), "exact", 50, "EUR") is expected


@pytest.mark.parametrize("patch,expected", PROOF_CASES, ids=[f"proof_{i:02d}" for i in range(15)])
def test_proof_binding_and_lifetime(patch, expected):
    now = datetime(2026, 11, 9, 12, 0, tzinfo=timezone.utc)
    fields = dict(url="https://shop.example/product", title="Exact", product_id="exact", price=50, currency="EUR")
    proof = dict(**fields, passed=True, checked_at=now.isoformat())
    updates = dict(patch)
    if "age" in updates:
        proof["checked_at"] = (now - timedelta(seconds=updates.pop("age"))).isoformat()
    proof.update(updates)
    assert purchase_link_allowed(proof, **fields, now=now) is expected
