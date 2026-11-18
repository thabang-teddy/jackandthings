"""Fixtures for the browser journeys.

These tests drive a real Chromium against a real server: no Django test client, no
Inertia headers, no shortcuts. If a page needs JavaScript that was never built, or a
view blows up only when `request.user` is the lazy object a request carries, this is
the layer that notices.

They need two things the unit tests do not:
  * `npm --prefix frontend run build` — the pages load the built bundle;
  * `python -m playwright install chromium` — the browser itself.

Both are checked below, and the journeys skip with a plain message instead of failing
obscurely when they are missing.
"""
from __future__ import annotations

import json
import os
import time

# Playwright's sync API runs the test inside a greenlet that looks like an async context
# to Django, which then refuses to touch the database. The ORM calls here are genuinely
# synchronous — the browser lives in another thread — so the check is the wrong one.
os.environ.setdefault("DJANGO_ALLOW_ASYNC_UNSAFE", "1")

import pytest  # noqa: E402
from django.conf import settings  # noqa: E402
from django.contrib.auth import get_user_model  # noqa: E402
from playwright.sync_api import TimeoutError as PlaywrightTimeout  # noqa: E402

PASSWORD = "a-long-password-1"          # the journeys' own account, created per test
NARROW_SPACES = (" ", " ")    # R 1 000,00 is written with non-breaking spaces


@pytest.fixture(scope="session", autouse=True)
def _built_assets():
    if settings.DJANGO_VITE["default"]["dev_mode"]:
        pytest.skip("Run the journeys with --ds=config.settings.e2e, which reads the built manifest")
    manifest = settings.BASE_DIR / "static" / "dist" / "manifest.json"
    if not manifest.exists():
        pytest.skip("No built assets. Run: npm --prefix frontend run build")
    if not json.loads(manifest.read_text()).get("src/main.tsx", {}).get("file"):
        pytest.skip("manifest.json has no src/main.tsx entry — rebuild the frontend")


@pytest.fixture
def owner(transactional_db):
    """A verified account, the way somebody who has already signed up would arrive.

    transactional_db, not db: the live server answers on another thread with its own
    connection, so a row written inside the test's transaction would be invisible to it.
    """
    from django.utils import timezone

    return get_user_model().objects.create_user(
        "owner@example.com", PASSWORD, name="Sam Owner", email_verified_at=timezone.now())


@pytest.fixture
def bench_press(owner):
    """One exercise to train with.

    The library is seeded by a migration, but a transactional test flushes the tables it
    filled, so a journey that needs an exercise says so rather than hoping.
    """
    from apps.training.models import Exercise

    row, _ = Exercise.objects.get_or_create(
        owner=None, name="Bench press", defaults={"muscle": "chest", "equipment": "barbell"})
    return row


@pytest.fixture
def app(page, live_server, owner):
    """A signed-in browser on the Today page."""
    return SignedIn(page, live_server.url, owner)


class SignedIn:
    """The small vocabulary the journeys use: visit a page, fill a field, press a button."""

    def __init__(self, page, base_url: str, user) -> None:
        self.page = page
        self.base = base_url.rstrip("/")
        self.user = user
        self.sign_in()

    # --- navigation -----------------------------------------------------------------

    def visit(self, path: str):
        self.page.goto(f"{self.base}{path}", wait_until="networkidle")
        return self.page

    def section(self, name: str):
        """Click a section in the masthead, as a person would."""
        self.page.get_by_role("link", name=name, exact=True).first.click()
        self.settle()

    def settle(self):
        """Wait for the page to stop working.

        Inertia swaps the page without a document load, so `networkidle` is the only load
        state that means anything here — and even that can land a beat before the URL
        changes, which is why `follow` waits on the URL itself.
        """
        self.page.wait_for_load_state("networkidle")

    def follow(self, gone: str, *, timeout: int = 8_000) -> bool:
        """True once the URL no longer contains `gone`."""
        try:
            self.page.wait_for_url(lambda url: gone not in url, timeout=timeout)
            return True
        except PlaywrightTimeout:
            return False

    # --- actions --------------------------------------------------------------------

    def fill(self, label: str, value: str):
        self.page.get_by_label(label, exact=False).first.fill(value)

    def press(self, name: str, *, timeout: int = 10_000):
        # Exact first: "Add" must not land on "+ Add a card", which merely contains it.
        exact = self.page.get_by_role("button", name=name, exact=True)
        button = (exact if exact.count() else self.page.get_by_role("button", name=name, exact=False)).first
        try:
            button.click(timeout=timeout)
        except PlaywrightTimeout as exc:   # say what was on the page, not just "timed out"
            found = self.page.get_by_role("button").all_inner_texts()
            raise AssertionError(
                f"Could not press {name!r}. Buttons on the page: {found}\n\n{self.text}") from exc
        self.settle()

    def sign_in(self):
        self.page.goto(f"{self.base}/login/", wait_until="networkidle")
        self.fill("Email", self.user.email)
        self.fill("Password", PASSWORD)
        # On a cold browser the first click can land in the moment between the form
        # appearing and React listening, and then nothing happens at all. Press again
        # rather than let every journey fail at its first step; if it still will not go
        # through, say why instead of failing somewhere later.
        for attempt in range(3):
            if attempt:
                self.page.get_by_label("Password", exact=False).first.fill(PASSWORD)
            self.press("Sign in")
            if self.follow("/login", timeout=5_000):
                return
        raise AssertionError(f"Sign-in did not go through. The page says:\n{self.text}")

    # --- reading --------------------------------------------------------------------

    @property
    def text(self) -> str:
        """The page as a person reads it, with the typographic spaces flattened.

        Amounts are formatted en-ZA with non-breaking spaces, which no test should have
        to spell.
        """
        body = self.page.locator("body").inner_text()
        for space in NARROW_SPACES:
            body = body.replace(space, " ")
        return body

    def shows(self, needle: str, *, timeout: int = 6_000) -> bool:
        """Does the page say this, now or within a moment?

        Polling, not a single read: an Inertia page arrives a beat after the click that
        asked for it, and a test that reads once would be a coin toss.
        """
        deadline = time.monotonic() + timeout / 1000
        while True:
            if needle in self.text:
                return True
            if time.monotonic() > deadline:
                return False
            self.page.wait_for_timeout(100)
