"""Backend tests for GlitchRadar API (real-RSS version)."""
import os
import re
import time
import threading
import pytest
import requests

BASE_URL = os.environ.get("GLITCHRADAR_TEST_URL",
                          "https://error-scout-20.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- root -----
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    j = r.json()
    assert "sources" in j and isinstance(j["sources"], list) and j["sources"]


# ----- list glitches: only real finds, every item has source_url + label -----
def test_list_glitches_real_sources(session):
    r = session.get(f"{API}/glitches")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0, "no real finds returned"
    for g in data:
        assert g.get("source_url"), f"missing source_url: {g}"
        host = g["source_url"]
        assert any(h in host for h in (
            "mydealz.de", "dealdoktor.de", "preisjaeger.at",
            "mytopdeals.net", "sparhamster.at",
        )), host
        assert g.get("source_label"), "missing source_label"
        assert g.get("published_at")
        # Must NOT be a KI/DEMO find
        assert g["source_label"] not in ("KI-SCOUT", "DEMO-SEED")


def test_list_glitches_filter_type_coupon(session):
    r = session.get(f"{API}/glitches", params={"type": "coupon"})
    assert r.status_code == 200
    for g in r.json():
        assert g["type"] == "coupon"


def test_list_glitches_filter_type_deal(session):
    r = session.get(f"{API}/glitches", params={"type": "deal"})
    assert r.status_code == 200
    for g in r.json():
        assert g["type"] == "deal"


def test_list_glitches_min_discount(session):
    r = session.get(f"{API}/glitches", params={"min_discount": 50})
    assert r.status_code == 200
    for g in r.json():
        assert g["discount_pct"] >= 50


def test_list_glitches_sort_discount(session):
    r = session.get(f"{API}/glitches", params={"sort": "discount"})
    assert r.status_code == 200
    pcts = [g["discount_pct"] for g in r.json()]
    assert pcts == sorted(pcts, reverse=True)


def test_list_glitches_sort_hot(session):
    r = session.get(f"{API}/glitches", params={"sort": "hot"})
    assert r.status_code == 200
    temps = [g.get("temperature") or -10000 for g in r.json()]
    assert temps == sorted(temps, reverse=True)


# ----- codes -----
def test_codes_only_with_coupon(session):
    r = session.get(f"{API}/codes")
    assert r.status_code == 200
    for g in r.json():
        assert g.get("coupon_code"), "code entry missing coupon_code"
        assert g.get("status") == "active"


# ----- detail / 404 / 400 -----
def test_get_glitch_detail(session):
    lst = session.get(f"{API}/glitches").json()
    assert lst
    gid = lst[0]["id"]
    r = session.get(f"{API}/glitches/{gid}")
    assert r.status_code == 200
    assert r.json()["id"] == gid


def test_get_glitch_404(session):
    r = session.get(f"{API}/glitches/507f1f77bcf86cd799439011")
    assert r.status_code == 404


def test_get_glitch_invalid_id(session):
    r = session.get(f"{API}/glitches/not-an-id")
    assert r.status_code == 400


# ----- vote -----
def test_vote_up_down(session):
    lst = session.get(f"{API}/glitches").json()
    gid = lst[0]["id"]
    before = lst[0]
    up = session.post(f"{API}/glitches/{gid}/vote", json={"up": True})
    assert up.status_code == 200
    assert up.json()["votes_up"] == before["votes_up"] + 1
    down = session.post(f"{API}/glitches/{gid}/vote", json={"up": False})
    assert down.status_code == 200
    assert down.json()["votes_down"] == before["votes_down"] + 1


def test_vote_404(session):
    r = session.post(f"{API}/glitches/507f1f77bcf86cd799439011/vote", json={"up": True})
    assert r.status_code == 404


def test_vote_400(session):
    r = session.post(f"{API}/glitches/not-an-id/vote", json={"up": True})
    assert r.status_code == 400


# ----- img proxy -----
def test_img_proxy_allowed_host(session):
    lst = session.get(f"{API}/glitches").json()
    img = next((g["image_url"] for g in lst
                if g.get("image_url") and "static.mydealz.de" in g["image_url"]), None)
    if not img:
        pytest.skip("no mydealz image available in current feed")
    r = session.get(f"{API}/img", params={"u": img})
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/")


def test_img_proxy_rejects_other_host(session):
    r = session.get(f"{API}/img", params={"u": "https://example.com/foo.jpg"})
    assert r.status_code == 400


# ----- stats -----
def test_stats(session):
    r = session.get(f"{API}/stats")
    assert r.status_code == 200
    data = r.json()
    for k in ("active_count", "expired_count", "total_found",
              "total_savings_potential", "avg_discount", "by_type"):
        assert k in data
    assert isinstance(data["total_savings_potential"], (int, float))


# ----- scans/recent -----
def test_scans_recent(session):
    r = session.get(f"{API}/scans/recent")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ----- report dead -----
def test_report_dead(session):
    lst = session.get(f"{API}/glitches").json()
    gid = lst[-1]["id"]
    rep = session.post(f"{API}/glitches/{gid}/report-dead")
    assert rep.status_code == 200
    assert rep.json().get("ok") is True
    g = session.get(f"{API}/glitches/{gid}").json()
    assert g["status"] == "expired"


def test_report_dead_404(session):
    r = session.post(f"{API}/glitches/507f1f77bcf86cd799439099/report-dead")
    assert r.status_code == 404


# ----- scan dedupe + concurrent 409 (ONE MANUAL SCAN PAIR) -----
def test_scan_dedupe_and_concurrent_409(session):
    # Wait up to 60s for background poll's scan lock to clear
    deadline = time.time() + 60
    while time.time() < deadline:
        r = requests.post(f"{API}/scan", timeout=240)
        if r.status_code != 409:
            first_resp = r
            break
        time.sleep(3)
    else:
        pytest.skip("background poller held lock >60s")

    # First completed → fire a quick 2nd scan to assert dedupe (or race-free 409 won't fire now)
    assert first_resp.status_code in (200, 502)
    if first_resp.status_code == 200:
        payload = first_resp.json()
        assert "glitches" in payload
        for g in payload["glitches"]:
            assert g["source_url"].startswith("https://")

    # Dedupe: a second manual scan right after a completed scan should yield 0 or very few new finds
    r2 = requests.post(f"{API}/scan", timeout=120)
    assert r2.status_code in (200, 409, 502)
    if first_resp.status_code == 200 and r2.status_code == 200:
        assert r2.json()["scan"]["found_count"] <= 5
    elif first_resp.status_code != 200 and r2.status_code == 200:
        r3 = requests.post(f"{API}/scan", timeout=120)
        assert r3.status_code in (200, 409, 502)
        if r3.status_code == 200:
            assert r3.json()["scan"]["found_count"] <= 5

    # Separately exercise the concurrency guard via a tight race
    results = {}

    def kick():
        results["a"] = requests.post(f"{API}/scan", timeout=120)

    t = threading.Thread(target=kick)
    t.start()
    time.sleep(0.05)
    results["b"] = requests.post(f"{API}/scan", timeout=30)
    t.join()
    codes = {results["a"].status_code, results["b"].status_code}
    assert 409 in codes, f"concurrency guard never fired: {codes}"


# ----- enrichment (ONE LLM CALL ONLY) -----
def test_enrich_once(session):
    lst = session.get(f"{API}/glitches").json()
    target = next((g for g in lst if not g.get("enriched")), None)
    if not target:
        pytest.skip("all glitches already enriched")
    r = requests.post(f"{API}/glitches/{target['id']}/enrich", timeout=120)
    if r.status_code == 503 and "Optionale KI-Analyse nicht eingerichtet" in r.text:
        pytest.skip("optional AI enrichment not configured on target backend")
    assert r.status_code == 200, f"enrich: {r.status_code} {r.text[:200]}"
    body = r.json()
    assert body["enriched"] is True
    assert isinstance(body["instructions"], list) and len(body["instructions"]) >= 3
    assert body.get("risk_analysis")
