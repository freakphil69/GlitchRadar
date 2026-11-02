"""Iteration 6: HTML-fragment sanitization of glitch titles/descriptions + _to_text unit tests."""
import os
import re
import sys

import pytest
import requests

BASE_URL = os.environ.get("GLITCHRADAR_TEST_URL", "https://error-scout-20.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from feeds import _to_text  # noqa: E402

TAG_FRAGMENT = re.compile(r"<")
ENTITY = re.compile(r"&(#\d+|#x[0-9a-f]+|[a-z]+);", re.I)


def _check_items(items, label):
    bad = []
    for g in items:
        for f in ("title", "description"):
            v = g.get(f) or ""
            if TAG_FRAGMENT.search(v) or ENTITY.search(v):
                bad.append((label, g.get("id"), f, v[:120]))
    return bad


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# --- API level: no HTML in served data ---
@pytest.mark.parametrize("path", ["/glitches", "/glitches?type=delivery", "/glitches?sort=hot",
                                  "/glitches?type=price_error", "/glitches?type=coupon", "/alarm",
                                  "/hall-of-fame"])
def test_no_html_in_endpoint(s, path):
    r = s.get(f"{API}{path}", timeout=30)
    assert r.status_code == 200, r.text[:200]
    data = r.json()
    items = data if isinstance(data, list) else data.get("items", data.get("glitches", []))
    assert isinstance(items, list)
    bad = _check_items(items, path)
    assert not bad, f"HTML leftovers: {bad[:5]}"


def test_glitches_nonempty_and_descriptions_clean_end(s):
    items = s.get(f"{API}/glitches", timeout=30).json()
    assert len(items) > 0
    for g in items:
        d = (g.get("description") or "").strip()
        assert not d.endswith(("<", "&", "</", "<str", "<a")), d[-40:]


def test_detail_clean(s):
    items = s.get(f"{API}/glitches", timeout=30).json()
    for g in items[:5]:
        r = s.get(f"{API}/glitches/{g['id']}", timeout=30)
        assert r.status_code == 200
        assert not _check_items([r.json()], "detail")


# --- unit: _to_text ---
def test_to_text_partial_tag():
    out = _to_text("Super Deal bei Amazon <str")
    assert "<" not in out and out.startswith("Super Deal bei Amazon")
    assert out.endswith("…")


def test_to_text_double_escaped():
    out = _to_text("&amp;lt;strong&amp;gt;Fett&amp;lt;/strong&amp;gt; &amp;amp; mehr &lt;a href=&quot;x")
    assert "<" not in out and "&" not in out.replace("& mehr", ""), out
    assert "Fett" in out


def test_to_text_anchor():
    out = _to_text('Hier <a href="https://x.de">Link</a> klicken.')
    assert out == "Hier Link klicken."


def test_to_text_numeric_entities():
    out = _to_text("Preis&#8211;Knaller &#x2013; jetzt")
    assert "&#" not in out


def test_to_text_ellipsis_normalized():
    assert _to_text("Ende ...").endswith("…")
