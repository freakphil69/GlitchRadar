import asyncio
import json
import sys
from pathlib import Path

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from link_checks import check_product_link


@pytest.mark.parametrize("action,expected", [
    ('<button>In den Warenkorb</button>', True),
    ('<a>In den Warenkorb</a>', False),
    ('<a href="https://[broken/cart">In den Warenkorb</a>', False),
    ('<a href="https://">In den Warenkorb</a>', False),
    ('<a href="https://user:pass@shop.example/cart">In den Warenkorb</a>', False),
    ('<a href="https://shop.example:bad/cart">In den Warenkorb</a>', False),
    ('<a href="https://127.0.0.1/cart">In den Warenkorb</a>', False),
    ('<button><span hidden>In den Warenkorb</span>Info</button>', False),
    ('<fieldset disabled><button>In den Warenkorb</button></fieldset>', False),
    ('<div inert><button>In den Warenkorb</button></div>', False),
    ('<template><button>In den Warenkorb</button></template>', False),
    ('<button aria-disabled="TRUE">In den Warenkorb</button>', False),
    ('<button>In den <span>Warenkorb</span></button>', True),
    ('<a href="/cart/add">In den Warenkorb</a>', True),
])
def test_parser_through_backend_link_check(action, expected):
    async def run():
        product = {"@type": "Product", "sku": "exact", "offers": {
            "@type": "Offer", "price": "50.00", "priceCurrency": "EUR",
            "availability": "https://schema.org/InStock"}}
        body = '<script type="application/ld+json">' + json.dumps(product) + '</script>' + action
        transport = httpx.MockTransport(lambda request: httpx.Response(
            200, text=body, headers={"content-type": "text/html"}))
        async with httpx.AsyncClient(transport=transport) as client:
            proof = await check_product_link(client,
                url="https://shop.example/product", title="Exact", product_id="exact",
                price=50, currency="EUR", allowed_hosts={"shop.example"})
        assert proof["passed"] is expected
    asyncio.run(run())
