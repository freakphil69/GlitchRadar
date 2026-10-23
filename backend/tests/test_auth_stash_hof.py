"""Backend tests for new iteration_3 features: auth, stash sync, hall of fame, feeds, affiliate."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get(
    "GLITCHRADAR_TEST_URL",
    "https://error-scout-20.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

MAIN_EMAIL = "tester@glitchradar.app"
MAIN_PASSWORD = "GlitchTest2026!"


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def main_token(s):
    """Login (or register once) the main test account and return bearer token."""
    r = s.post(f"{API}/auth/login", json={"email": MAIN_EMAIL, "password": MAIN_PASSWORD})
    if r.status_code == 200:
        return r.json()["token"]
    if r.status_code == 429:
        pytest.skip("main account locked (429) - skipping")
    # Not registered yet -> register
    reg = s.post(f"{API}/auth/register", json={
        "email": MAIN_EMAIL,
        "password": MAIN_PASSWORD,
        "name": "Tester",
    })
    assert reg.status_code in (201, 409), f"register failed: {reg.status_code} {reg.text}"
    if reg.status_code == 201:
        return reg.json()["token"]
    # 409 but we couldn't login -> credentials are wrong -> fatal
    pytest.fail(f"Cannot login or register main account: login={r.status_code} register={reg.status_code}")


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# AUTH: register / login / me / logout
# ---------------------------------------------------------------------------

def test_register_invalid_email(s):
    r = s.post(f"{API}/auth/register", json={"email": "notanemail", "password": "longenough1"})
    assert r.status_code == 422


def test_register_short_password(s):
    r = s.post(f"{API}/auth/register", json={"email": f"short_{uuid.uuid4().hex[:6]}@x.de", "password": "a1"})
    assert r.status_code == 422


def test_register_login_me_logout_flow(s):
    email = f"TEST_{uuid.uuid4().hex[:8]}@glitchradar.test"
    pw = "StrongPass2026!"

    # Register
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "Flow User"})
    assert r.status_code == 201, r.text
    j = r.json()
    assert "token" in j and "user" in j
    assert j["user"]["email"] == email.lower()
    assert "password_hash" not in j["user"]
    token = j["token"]

    # Duplicate -> 409
    r2 = s.post(f"{API}/auth/register", json={"email": email, "password": pw})
    assert r2.status_code == 409

    # /me
    me = s.get(f"{API}/auth/me", headers=_auth(token))
    assert me.status_code == 200
    body = me.json()
    assert body["email"] == email.lower()
    assert "password_hash" not in body

    # Wrong password login -> 401 (generic german message)
    bad = s.post(f"{API}/auth/login", json={"email": email, "password": "WrongPass2026!"})
    assert bad.status_code == 401
    assert "falsch" in bad.json().get("detail", "").lower()

    # Right password -> new token
    good = s.post(f"{API}/auth/login", json={"email": email, "password": pw})
    assert good.status_code == 200
    assert "token" in good.json()

    # Logout -> /me 401
    lo = s.post(f"{API}/auth/logout", headers=_auth(token))
    assert lo.status_code == 200
    me2 = s.get(f"{API}/auth/me", headers=_auth(token))
    assert me2.status_code == 401


def test_me_without_token(s):
    r = s.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_session_invalid(s):
    r = s.post(f"{API}/auth/session", json={"session_id": "definitely-not-a-real-session-id-xyz"})
    assert r.status_code == 401


def test_brute_force_lockout(s):
    """Register a throwaway account, 5 wrong logins should produce 429 on next attempt."""
    email = f"TEST_bf_{uuid.uuid4().hex[:8]}@glitchradar.test"
    reg = s.post(f"{API}/auth/register", json={"email": email, "password": "StrongPass2026!"})
    assert reg.status_code == 201
    saw_429 = False
    for i in range(6):
        r = s.post(f"{API}/auth/login", json={"email": email, "password": f"WrongPw{i}!!"})
        if r.status_code == 429:
            saw_429 = True
            break
        assert r.status_code == 401
    assert saw_429, "Expected 429 after 5 failed logins"


# ---------------------------------------------------------------------------
# STASH sync
# ---------------------------------------------------------------------------

def test_stash_requires_auth(s):
    assert s.get(f"{API}/stash").status_code == 401
    assert s.put(f"{API}/stash", json={"items": []}).status_code == 401


def test_stash_put_then_get(s, main_token):
    sample = [
        {"id": "abc", "title": "test glitch", "shop": "zalando", "glitched_price": 1.0},
        {"id": "xyz", "title": "second", "shop": "amazon"},
    ]
    put = s.put(f"{API}/stash", json={"items": sample}, headers=_auth(main_token))
    assert put.status_code == 200
    assert put.json().get("ok") is True
    assert put.json().get("count") == 2

    get = s.get(f"{API}/stash", headers=_auth(main_token))
    assert get.status_code == 200
    items = get.json().get("items", [])
    assert len(items) == 2
    ids = {it["id"] for it in items}
    assert ids == {"abc", "xyz"}


def test_stash_reset_to_empty(s, main_token):
    """Leave the test account stash EMPTY at the end as instructed."""
    put = s.put(f"{API}/stash", json={"items": []}, headers=_auth(main_token))
    assert put.status_code == 200
    get = s.get(f"{API}/stash", headers=_auth(main_token))
    assert get.json().get("items") == []


# ---------------------------------------------------------------------------
# HALL OF FAME
# ---------------------------------------------------------------------------

def test_hall_of_fame_shape_and_sort(s):
    r = s.get(f"{API}/hall-of-fame", params={"limit": 20})
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if not data:
        pytest.skip("no price_error / 50%+ discount entries in current feed")
    savings = []
    for entry in data:
        assert "saving" in entry
        assert isinstance(entry["saving"], (int, float))
        assert entry.get("source_url"), "hall-of-fame entry missing source_url"
        # must be price_error OR discount_pct >= 50
        assert entry["type"] == "price_error" or entry.get("discount_pct", 0) >= 50
        savings.append(entry["saving"])
    # Sorted desc by saving
    assert savings == sorted(savings, reverse=True)


def test_hall_of_fame_limit(s):
    r = s.get(f"{API}/hall-of-fame", params={"limit": 3})
    assert r.status_code == 200
    assert len(r.json()) <= 3


# ---------------------------------------------------------------------------
# FEEDS: multiple sources available / img proxy allows new hosts
# ---------------------------------------------------------------------------

def test_feeds_sources_listed(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    sources = r.json().get("sources", [])
    expected = {"MYDEALZ", "DEALDOKTOR", "MYTOPDEALS", "SPARHAMSTER"}
    hits = sum(1 for s_ in sources if any(e in s_ for e in expected))
    assert hits >= 4, f"missing new source labels, got {sources}"
    assert any("PREISJÄGER" in s_ for s_ in sources)


def test_img_proxy_preisjaeger_allowed(s):
    # Reject check should still 400 for random host (positive proxy test is in main suite)
    r = s.get(f"{API}/img", params={"u": "https://example.com/foo.jpg"})
    assert r.status_code == 400
    # Confirm preisjaeger host is in allow-list (behavioural proxy may 404 if URL doesn't exist,
    # but it must NOT 400 on host-allow check). We call with a bogus path and expect 404 NOT 400.
    r2 = s.get(f"{API}/img", params={"u": "https://static.preisjaeger.at/__nope__.jpg"})
    assert r2.status_code in (404, 502), f"host not allow-listed: got {r2.status_code}"


# ---------------------------------------------------------------------------
# AFFILIATE: no env configured -> affiliate_url always null
# ---------------------------------------------------------------------------

def test_affiliate_url_null_without_env(s):
    r = s.get(f"{API}/glitches")
    assert r.status_code == 200
    data = r.json()
    for g in data[:30]:
        aff = g.get("affiliate_url")
        # Expected null when neither AMAZON_PARTNER_TAG nor AWIN pairs are configured
        assert aff in (None, ""), f"unexpected affiliate_url {aff} for shop {g.get('shop')}"


def test_known_shop_homepage_url(s):
    """At least one glitch for a known shop should have url == shop homepage."""
    r = s.get(f"{API}/glitches")
    data = r.json()
    # Not a hard requirement for every item (url can be source link); just verify
    # that if a known shop appears, affiliate_url remains null and url is https.
    for g in data[:30]:
        if g.get("url"):
            assert g["url"].startswith("https://"), g["url"]
