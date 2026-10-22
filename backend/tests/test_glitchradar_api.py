"""Backend tests for GlitchRadar API."""
import os
import time
import threading
import pytest
import requests

BASE_URL = "https://error-scout-20.preview.emergentagent.com".rstrip("/")
API = f"{BASE_URL}/api"

KNOWN_SHOPS = {"zalando", "otto", "mediamarkt", "amazon", "amazon marketplace",
               "ikea", "decathlon", "about you", "lieferando", "nike", "rossmann"}


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ----- health -----
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "scout" in r.json()


# ----- list glitches -----
def test_list_glitches_default(session):
    r = session.get(f"{API}/glitches")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list) and len(data) > 0
    for g in data:
        assert "url" in g and "affiliate_url" in g
        shop = (g.get("shop") or "").lower()
        if shop in KNOWN_SHOPS:
            assert g["url"] is not None, f"url None for known shop {shop}"
            assert g["affiliate_url"] is not None, f"affiliate None for known shop {shop}"


def test_list_glitches_filter_type(session):
    r = session.get(f"{API}/glitches", params={"type": "coupon"})
    assert r.status_code == 200
    for g in r.json():
        assert g["type"] == "coupon"


def test_list_glitches_min_discount(session):
    r = session.get(f"{API}/glitches", params={"min_discount": 60})
    assert r.status_code == 200
    for g in r.json():
        assert g["discount_pct"] >= 60


def test_list_glitches_sort_discount(session):
    r = session.get(f"{API}/glitches", params={"sort": "discount"})
    assert r.status_code == 200
    data = r.json()
    pcts = [g["discount_pct"] for g in data]
    assert pcts == sorted(pcts, reverse=True)


# ----- get single glitch (tz fix) -----
def test_get_glitch_detail(session):
    lst = session.get(f"{API}/glitches").json()
    assert lst, "no glitches to test with"
    gid = lst[0]["id"]
    r = session.get(f"{API}/glitches/{gid}")
    assert r.status_code == 200, f"detail returned {r.status_code}: {r.text}"
    body = r.json()
    assert body["id"] == gid
    assert "url" in body and "affiliate_url" in body


def test_get_glitch_404(session):
    r = session.get(f"{API}/glitches/507f1f77bcf86cd799439011")
    assert r.status_code == 404


def test_get_glitch_invalid_id(session):
    r = session.get(f"{API}/glitches/not-an-id")
    assert r.status_code == 400


# ----- stats -----
def test_stats(session):
    r = session.get(f"{API}/stats")
    assert r.status_code == 200
    data = r.json()
    for k in ("active_count", "expired_count", "total_found",
              "total_savings_potential", "avg_discount", "by_type"):
        assert k in data


# ----- recent scans -----
def test_scans_recent(session):
    r = session.get(f"{API}/scans/recent")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ----- report dead -----
def test_report_dead(session):
    # pick a seed one we're happy to kill
    r = session.get(f"{API}/glitches").json()
    assert r
    gid = r[-1]["id"]
    rep = session.post(f"{API}/glitches/{gid}/report-dead")
    assert rep.status_code == 200
    assert rep.json().get("ok") is True
    # verify now expired
    g = session.get(f"{API}/glitches/{gid}").json()
    assert g["status"] == "expired"


def test_report_dead_404(session):
    r = session.post(f"{API}/glitches/507f1f77bcf86cd799439099/report-dead")
    assert r.status_code == 404


# ----- scan + concurrent 409 (ONE PAIR ONLY) -----
def test_scan_and_concurrent_409(session):
    results = {}

    def kick():
        results["first"] = requests.post(f"{API}/scan", timeout=180)

    t = threading.Thread(target=kick)
    t.start()
    # give the first request a moment to acquire the lock
    time.sleep(2.0)
    second = requests.post(f"{API}/scan", timeout=30)
    results["second"] = second
    t.join()
    first = results["first"]
    assert first.status_code in (200, 502), f"scan unexpected {first.status_code}: {first.text[:300]}"
    assert second.status_code == 409, f"concurrent scan expected 409, got {second.status_code}: {second.text[:200]}"
    if first.status_code == 200:
        payload = first.json()
        assert "glitches" in payload and isinstance(payload["glitches"], list)
        for g in payload["glitches"]:
            assert "url" in g and "affiliate_url" in g


# ----- enrichment (ONE CALL ONLY) -----
def test_enrich_once(session):
    # pick an active, not-yet-enriched glitch
    lst = session.get(f"{API}/glitches").json()
    target = next((g for g in lst if not g.get("enriched")), None)
    assert target, "no un-enriched glitch available"
    r = requests.post(f"{API}/glitches/{target['id']}/enrich", timeout=120)
    assert r.status_code == 200, f"enrich failed {r.status_code}: {r.text[:300]}"
    body = r.json()
    assert body.get("enriched") is True
    assert isinstance(body.get("instructions"), list) and len(body["instructions"]) >= 3
    assert isinstance(body.get("tips"), list)
    assert body.get("risk_analysis")
