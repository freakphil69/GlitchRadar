"""Fail-closed purchase evidence checks; no live network or paid services."""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from link_checks import page_matches, purchase_link_allowed


def page(action="<button>In den Warenkorb</button>", offer_price="50.00"):
    product = {
        "@type": "Product", "sku": "exact",
        "offers": {
            "@type": "Offer", "price": offer_price, "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock",
        },
    }
    return '<script type="application/ld+json">' + json.dumps(product) + "</script>" + action


@pytest.mark.parametrize("tag", ["script", "style", "noscript", "template"])
def test_nonvisible_buy_text_does_not_authorize_purchase(tag):
    markup = page(f"<button><{tag}>In den Warenkorb</{tag}>Mehr erfahren</button>")
    assert page_matches(markup, "exact", 50, "EUR") is False


@pytest.mark.parametrize("tag", ["script", "style", "noscript", "template"])
def test_visible_buy_text_still_works_after_nonvisible_child(tag):
    markup = page(f"<button><{tag}>Nicht verfügbar</{tag}>In den Warenkorb</button>")
    assert page_matches(markup, "exact", 50, "EUR") is True


@pytest.mark.parametrize("price", [True, False, -1, float("inf"), float("nan"), "50", {}, []])
def test_invalid_expected_price_fails_closed_without_crashing(price):
    assert page_matches(page(offer_price=price), "exact", price, "EUR") is False


@pytest.mark.parametrize("price", [True, False, -1, "-1", float("inf"), float("nan")])
def test_invalid_merchant_price_is_not_purchase_evidence(price):
    expected = 1 if price is True else 0 if price is False else -1
    assert page_matches(page(offer_price=price), "exact", expected, "EUR") is False


@pytest.mark.parametrize("price", [True, False, -1, float("inf"), float("nan"), "50", {}, []])
def test_saved_proof_cannot_authorize_invalid_expected_price(price):
    now = datetime(2026, 11, 12, 12, tzinfo=timezone.utc)
    fields = dict(url="https://shop.example/item", title="Item", product_id="exact",
                  price=price, currency="EUR")
    proof = dict(**fields, passed=True, checked_at=now.isoformat())
    assert purchase_link_allowed(proof, **fields, now=now) is False


@pytest.mark.parametrize("price", [True, False])
def test_boolean_saved_proof_does_not_equal_numeric_price(price):
    now = datetime(2026, 11, 12, 12, tzinfo=timezone.utc)
    fields = dict(url="https://shop.example/item", title="Item", product_id="exact",
                  price=int(price), currency="EUR")
    proof = dict(**fields, passed=True, checked_at=now.isoformat())
    proof["price"] = price
    assert purchase_link_allowed(proof, **fields, now=now) is False


@pytest.mark.parametrize("price", [0, 0.0, 1, 50.0])
def test_finite_nonnegative_prices_remain_supported(price):
    assert page_matches(page(offer_price=str(price)), "exact", price, "EUR") is True
