"""Offline core-flow checks. No real accounts, paid AI calls or live database."""
import asyncio
import importlib
import sys
from pathlib import Path

import httpx
import pytest
from mongomock_motor import AsyncMongoMockClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture
def server(monkeypatch):
    monkeypatch.setenv("MONGO_URL", "mongodb://localhost:27017")
    monkeypatch.setenv("DB_NAME", "beta_core_test")
    monkeypatch.setenv("JWT_SECRET", "offline-test-secret-not-for-deployment")
    monkeypatch.delenv("EMERGENT_LLM_KEY", raising=False)
    monkeypatch.delenv("ENABLE_AI_SCORING", raising=False)
    sys.modules.pop("server", None)
    module = importlib.import_module("server")
    monkeypatch.setattr(module, "db", AsyncMongoMockClient(tz_aware=True).beta_core_test)
    return module


def test_backend_imports_without_optional_ai(server):
    assert server.app is not None


def test_missing_product_link_never_becomes_shop_homepage(server, monkeypatch):
    monkeypatch.setenv("AMAZON_PARTNER_TAG", "offline-test")
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal",
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] is None
    assert item["affiliate_url"] is None


def test_affiliate_link_preserves_exact_product_target(server, monkeypatch):
    monkeypatch.setenv("AMAZON_PARTNER_TAG", "offline-test")
    product = "https://www.amazon.de/dp/B012345678?variant=black"
    proof = dict(passed=True, url=product, title="Konkreter Kopfhörer",
                 product_id="B012345678", price=50, currency="EUR",
                 checked_at=server._now().isoformat())
    _, affiliate = server.build_affiliate_link("Amazon", product)
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal", url=product,
        product_id="B012345678", glitched_price=50, link_check=proof,
        affiliate_check={**proof, "url": affiliate},
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] == product
    assert "/dp/B012345678" in item["affiliate_url"]
    assert "variant=black" in item["affiliate_url"]


def test_unchecked_product_path_is_not_a_purchase_link(server):
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal",
        url="https://www.amazon.de/dp/B012345678",
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] is None
    assert item["affiliate_url"] is None
    assert item["link_status"] == "unverified"


@pytest.mark.parametrize("boolean_price", [True, False])
def test_saved_boolean_price_proof_cannot_unlock_detail_purchase_link(server, boolean_price):
    async def run():
        url = "https://www.amazon.de/dp/B012345678"
        proof = dict(passed=True, url=url, title="Testfund", product_id="exact",
                     price=boolean_price, currency="EUR",
                     checked_at=server._now().isoformat())
        doc = server.GlitchDoc(
            title="Testfund", shop="Amazon", type="deal", url=url,
            product_id="exact", glitched_price=int(boolean_price), link_check=proof,
            source_url="https://www.mydealz.de/deals/testfund",
        )
        await server.db.glitches.insert_one(doc.to_mongo())
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://test"
        ) as client:
            # Reload the saved offer through the same API the app uses.
            response = await client.get(f"/api/glitches/{doc.id}")
            assert response.status_code == 200
            data = response.json()
            assert data["url"] is None
            assert data["affiliate_url"] is None
            assert data["link_status"] == "unverified"
    asyncio.run(run())


def test_direct_pass_does_not_authorize_unchecked_affiliate(server, monkeypatch):
    monkeypatch.setenv("AMAZON_PARTNER_TAG", "offline-test")
    url = "https://www.amazon.de/dp/B012345678"
    proof = dict(url=url, title="Kopfhörer", product_id="sku", price=50,
                 currency="EUR", passed=True, checked_at=server._now().isoformat())
    item = server.GlitchDoc(
        title="Kopfhörer", shop="Amazon", type="deal", url=url,
        product_id="sku", glitched_price=50, link_check=proof,
    ).out()
    assert item["url"] == url
    assert item["affiliate_url"] is None


def test_image_overflow_is_closed_and_returns_controlled_error(server, monkeypatch):
    async def overflow(*args, **kwargs):
        raise server.ResponseTooLarge("Testlimit")
    monkeypatch.setattr(server, "bounded_get", overflow)
    async def run():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            result = await client.get("/api/img", params={"u": "https://static.mydealz.de/photo.jpg"})
            assert result.status_code == 413
    asyncio.run(run())


def test_all_public_deal_views_apply_the_same_purchase_gate(server):
    async def run():
        doc = server.GlitchDoc(
            title="Testfund", shop="Amazon", type="price_error", coupon_code="RY7",
            url="https://www.amazon.de/dp/B012345678",
            source_url="https://www.mydealz.de/deals/testfund",
        )
        await server.db.glitches.insert_one(doc.to_mongo())
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=server.app), base_url="http://test") as client:
            for path in ["/api/glitches", "/api/codes", "/api/alarm",
                         f"/api/glitches/{doc.id}"]:
                result = await client.get(path)
                assert result.status_code == 200, path
                data = result.json()
                items = data if isinstance(data, list) else [data]
                assert items, path
                for item in items:
                    assert item["url"] is None, path
                    assert item["affiliate_url"] is None, path
                    assert item["link_status"] == "unverified", path
    asyncio.run(run())


def test_background_backcheck_persists_new_proof_without_ai(server, monkeypatch):
    async def run():
        doc = server.GlitchDoc(
            title="Exact model", shop="Conrad", type="deal",
            url="https://www.conrad.de/product/exact", product_id="exact",
            glitched_price=50,
        )
        await server.db.glitches.insert_one(doc.to_mongo())

        async def check(client, **kwargs):
            return {k: v for k, v in {
                **kwargs, "passed": True, "checked_at": server._now().isoformat(),
            }.items() if k != "allowed_hosts"}

        monkeypatch.setattr(server, "check_product_link", check)
        await server.recheck_purchase_links()
        stored = await server.db.glitches.find_one({"_id": doc.id})
        assert stored["link_check"]["passed"]
        assert server.GlitchDoc.from_mongo(stored).out()["link_status"] == "checked"
    asyncio.run(run())


def test_existing_shop_homepage_is_not_presented_as_product(server):
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal",
        url="https://www.amazon.de/",
        affiliate_url="https://www.amazon.de/?tag=old-tag",
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] is None
    assert item["affiliate_url"] is None


def test_legacy_price_conflict_is_not_shown_as_one_euro_tv(server):
    item = server.GlitchDoc(
        title="[Conrad Pro] LG OLED65C6ELB", shop="Conrad", type="coupon",
        description="1.215,27€ - Conrad. Mit PRO und Geschenkgutscheinen.",
        glitched_price=1.21, discount_pct=99,
        source_url="https://www.mydealz.de/deals/conrad-lg-2867338",
    ).out()
    assert item["glitched_price"] is None
    assert item["discount_pct"] == 0
    assert item["price_conflict"] is True


def test_core_scan_search_and_detail_without_ai(server, monkeypatch):
    async def run():
        async def feeds():
            return [{
                "title": "Kopfhörer Testfund",
                "shop": "Testshop",
                "category": "Elektronik",
                "description": "Ein echter Feed-Eintrag als Test-Fixture",
                "type": "deal",
                "source_url": "https://example.com/deal",
                "source_label": "TEST-FEED",
                "glitched_price": 50,
                "original_price": 100,
                "discount_pct": 50,
                "coupon_code": None,
            }], 1

        monkeypatch.setattr(server, "fetch_all_feeds", feeds)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://test"
        ) as client:
            scan = await client.post("/api/scan")
            assert scan.status_code == 200, scan.text
            assert scan.json()["scan"]["found_count"] == 1
            feed = await client.get("/api/glitches")
            assert feed.status_code == 200, feed.text
            assert len(feed.json()) == 1
            found = feed.json()[0]
            assert found["source_url"] == "https://example.com/deal"
            detail = await client.get(f"/api/glitches/{found['id']}")
            assert detail.status_code == 200
            assert detail.json()["title"] == "Kopfhörer Testfund"
            search = await client.get("/api/glitches", params={"q": "Kopfhörer"})
            assert len(search.json()) == 1
            assert (await client.get("/api/glitches", params={"q": "unbekannt"})).json() == []
            repeated = await client.post("/api/scan")
            assert repeated.json()["scan"]["found_count"] == 0

    asyncio.run(run())


def test_unreachable_feeds_give_recoverable_error(server, monkeypatch):
    async def run():
        async def offline():
            return [], 0
        monkeypatch.setattr(server, "fetch_all_feeds", offline)
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=server.app), base_url="http://test"
        ) as client:
            response = await client.post("/api/scan")
            assert response.status_code == 502
            assert "Quelle" in response.json()["detail"]
            assert not server.scan_lock.locked()

    asyncio.run(run())
