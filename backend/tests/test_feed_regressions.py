"""Offline reproductions from the real offer audit, not new live validations."""
import asyncio
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import httpx
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import feeds


@pytest.mark.parametrize("raw,expected", [
    ("1.215,27 €", 1215.27), ("1,215.27", 1215.27),
    ("1215.27", 1215.27), ("1.215", 1215),
    ("1\u202f215,27", 1215.27), ("28,85", 28.85),
    ("0,00", 0), ("n/a", None), ("1.215,278", None),
])
def test_price_does_not_truncate_grouped_or_invalid_numbers(raw, expected):
    assert feeds._price(raw) == expected


def test_conrad_audit_reproduction_through_real_feed_parser():
    item = ET.fromstring(f"""<item xmlns:pepper="{feeds.NS['pepper']}">
      <title>[Conrad Pro] LG OLED65C6ELB</title>
      <link>https://www.mydealz.de/deals/conrad-lg-2867338</link>
      <description>1.215,27€ - Conrad. Rabattcode: DEAL1126</description>
      <pepper:merchant name="Conrad" price="1.215,27"/>
    </item>""")
    result = feeds._parse_item(item, "mydealz", "MYDEALZ", None)
    assert result["glitched_price"] == 1215.27
    assert result["coupon_code"] == "DEAL1126"


def test_short_explicit_code_and_negated_combination():
    item = ET.fromstring("""<item>
      <title>Schnitzery 7 Euro Rabatt</title>
      <link>https://www.mydealz.de/gutscheine/schnitzery</link>
      <description>Gutscheincode: RY7. Nicht kombinierbar.</description>
    </item>""")
    result = feeds._parse_item(item, "mydealz", "MYDEALZ", "coupon")
    assert result["coupon_code"] == "RY7"
    assert result["type"] == "coupon"


def test_oversized_feed_is_stopped_before_buffering_entire_response(monkeypatch):
    monkeypatch.setattr(feeds, "MAX_FEED_BYTES", 128, raising=False)

    class Body(httpx.AsyncByteStream):
        chunks_read = 0
        closed = False

        async def __aiter__(self):
            for chunk in [b"<rss><channel><item><title>Deal</title><link>https://example.com</link><description>",
                          b"x" * 80, b"x" * 80, b"</description></item></channel></rss>"]:
                self.chunks_read += 1
                yield chunk

        async def aclose(self):
            self.closed = True

    async def run():
        body = Body()
        transport = httpx.MockTransport(lambda request: httpx.Response(200, stream=body))
        async with httpx.AsyncClient(transport=transport) as client:
            result = await feeds._fetch(client, "https://example.com/rss", "test", "TEST", None)
        assert result == []
        assert body.chunks_read < 4
        assert body.closed

    asyncio.run(run())


def test_feed_downloads_are_bounded_but_no_source_is_skipped(monkeypatch):
    async def run():
        active = peak = calls = 0

        async def fetch(client, url, *rest):
            nonlocal active, peak, calls
            active += 1
            calls += 1
            peak = max(peak, active)
            await asyncio.sleep(0)
            active -= 1
            return [{"source_url": url}]

        monkeypatch.setattr(feeds, "_fetch", fetch)
        items, count = await feeds.fetch_all_feeds()
        assert peak <= feeds.FEED_CONCURRENCY == 2
        assert calls == count == len(feeds.FEEDS)
        assert len(items) == len(feeds.FEEDS)

    asyncio.run(run())
