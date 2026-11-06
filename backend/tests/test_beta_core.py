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
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal", url=product,
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] == product
    assert "/dp/B012345678" in item["affiliate_url"]
    assert "variant=black" in item["affiliate_url"]


def test_existing_shop_homepage_is_not_presented_as_product(server):
    item = server.GlitchDoc(
        title="Konkreter Kopfhörer", shop="Amazon", type="deal",
        url="https://www.amazon.de/",
        affiliate_url="https://www.amazon.de/?tag=old-tag",
        source_url="https://www.mydealz.de/deals/konkreter-kopfhoerer-123",
    ).out()
    assert item["url"] is None
    assert item["affiliate_url"] is None


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
