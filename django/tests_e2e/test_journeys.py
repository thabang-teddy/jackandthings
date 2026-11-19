"""The journeys from PRD.md, walked in a real browser by a real account.

Each test is one thing a person actually does, start to finish, through the interface:
no test client, no direct service calls, nothing pre-seeded that the person could have
made themselves. They are slow on purpose — this is the layer that catches what the unit
tests cannot see, such as a view that only fails when `request.user` is the lazy object
a real request carries.
"""
import re

import pytest
from playwright.sync_api import expect

pytestmark = pytest.mark.e2e


# --- Arriving ---------------------------------------------------------------------------------


def test_signing_in_lands_on_today(app):
    assert app.page.url.rstrip("/").endswith(":" + app.base.split(":")[-1])
    assert app.shows("Jack & Things")
    for section in ("Today", "Focus", "Projects", "Notes", "Money", "Training", "Library"):
        assert app.shows(section)


def test_a_wrong_password_says_so_and_stays_put(page, live_server, owner):
    page.goto(f"{live_server.url}/login/", wait_until="networkidle")
    page.get_by_label("Email").fill(owner.email)
    page.get_by_label("Password").fill("not-the-password")
    page.get_by_role("button", name="Sign in").click()
    # expect() keeps looking while Inertia swaps the page in, so this is not a race.
    expect(page.locator("body")).to_contain_text("don't match", timeout=8_000)
    assert "/login" in page.url


def test_a_signed_out_visitor_is_sent_to_sign_in(page, live_server, transactional_db):
    page.goto(f"{live_server.url}/money/", wait_until="networkidle")
    assert "/login" in page.url


def test_signing_out(app):
    app.page.get_by_label("Account menu").first.click()      # the menu holds Settings and Sign out
    app.press("Sign out")
    app.visit("/notes/")
    assert "/login" in app.page.url


# --- Notes ------------------------------------------------------------------------------------


def test_writing_reading_and_deleting_a_note(app):
    app.section("Notes")
    assert app.shows("Nothing written yet") or app.shows("Notes")

    app.page.get_by_role("link", name="New note").first.click()
    app.page.wait_for_load_state("networkidle")
    app.fill("Title", "Kitchen tiles")
    app.page.get_by_label("Note").fill("Matte, 200x200, not the glossy ones.")
    app.press("Save")
    assert app.shows("Saved"), "the editor says when it has saved; wait for that before leaving"

    app.section("Notes")
    assert app.shows("Kitchen tiles")

    # The list shows a snippet of the body, so reading the page text here would pass without
    # ever opening the note. Wait for the URL, then read the fields themselves: the body is a
    # controlled <textarea>, and whether its value appears in body.innerText differs between
    # Chromium builds — it does in the local one and does not in CI's.
    app.open_link("Kitchen tiles", re.compile(r"/notes/\d+/"))
    assert app.value("Title") == "Kitchen tiles"
    assert "Matte, 200x200" in app.value("Note")

    app.press("Delete")
    app.press("Delete note")                 # the confirm dialog, not the first button
    assert app.shows("Nothing written yet") or not app.shows("Kitchen tiles", timeout=2_000)


# --- Focus ------------------------------------------------------------------------------------


def test_running_a_focus_timer_and_stopping_it(app):
    app.section("Focus")
    assert app.shows("Ready when you are")

    app.press("Start focus")
    assert re.search(r"2[45]:\d\d", app.text), "the countdown should be running"
    assert app.shows("Pause")

    app.press("Pause")
    assert app.shows("Resume")
    app.press("Resume")

    app.press("Stop")
    assert app.shows("Start focus"), "stopping should offer a fresh start"


# --- Projects (the card timer that used to raise AttributeError) --------------------------------


def test_making_a_board_and_tracking_time_on_a_card(app):
    app.section("Projects")

    app.page.get_by_role("button", name=re.compile("New project|Create the first one")).first.click()
    app.fill("Name", "Kitchen")
    app.press("Create project")                  # a new project opens on its own board
    assert app.shows("Kitchen") and app.shows("Backlog")

    app.press("Add a card")
    app.fill("Card title", "Choose tiles")
    app.press("Add")
    assert app.shows("Choose tiles")

    app.page.get_by_role("link", name="Choose tiles").first.click()
    assert app.shows("Start timer")

    app.press("Start timer")                     # the click that used to raise AttributeError
    assert app.shows("Stop") and app.shows("Pause")
    assert re.search(r"0:00:\d\d", app.text), "the clock should be counting"

    app.press("Stop")
    assert app.shows("Start timer")
    assert not app.shows("No time logged yet.", timeout=2_000), "the stopped entry should be listed"


def test_a_card_timer_shows_up_on_the_timesheet(app):
    app.visit("/projects/")
    app.page.get_by_role("button", name=re.compile("New project|Create the first one")).first.click()
    app.fill("Name", "Garden")
    app.press("Create project")
    app.press("Add a card")
    app.fill("Card title", "Order compost")
    app.press("Add")
    app.page.get_by_role("link", name="Order compost").first.click()
    app.press("Start timer")
    app.press("Stop")

    app.visit("/projects/time/")
    assert app.shows("Order compost")


# --- Money ------------------------------------------------------------------------------------


def test_adding_an_account_and_a_transaction_moves_the_balance(app):
    app.section("Money")
    app.visit("/money/accounts/")
    app.press("Add account")                     # opens the dialog
    app.fill("Name", "Cheque")
    app.page.get_by_label("Balance when you started (R)").first.fill("1000")
    app.press("Save")
    assert app.shows("Cheque") and app.shows("1 000,00")

    app.visit("/money/transactions/")
    app.press("Add transaction")
    app.fill("Description", "Hardware shop")
    app.page.get_by_label("Amount (R)").first.fill("250,50")
    app.press("Save")
    assert app.shows("Hardware shop")

    app.visit("/money/")
    assert app.shows("749,50"), "R 1 000,00 less R 250,50"


# --- Training ---------------------------------------------------------------------------------


def test_logging_a_workout(app, bench_press):
    app.section("Training")
    app.press("Empty workout")                   # starts it and opens the live page
    assert app.shows("Add an exercise")

    app.page.get_by_label("Add an exercise").first.select_option(label=bench_press.name)
    app.press("Add")
    assert app.shows(bench_press.name)

    app.press("Log")                             # tick the first set off
    app.press("Finish")
    app.press("Save workout")

    app.visit("/training/sessions/")
    assert app.shows("Workout")


# --- Library ----------------------------------------------------------------------------------


def test_keeping_a_watch_list(app):
    app.section("Library")
    app.page.get_by_role("button", name=re.compile("New list|Make a list")).first.click()
    app.fill("Name", "Read later")
    app.press("Create")
    assert app.shows("Read later")

    app.fill("Title", "The Daybook PDF")
    app.press("Add")
    assert app.shows("The Daybook PDF")


# --- Settings ---------------------------------------------------------------------------------


def test_choosing_the_dark_theme_sticks(app):
    app.visit("/settings/")
    app.page.get_by_role("radio", name="Dark").click()
    app.press("Save profile")
    app.visit("/")
    assert app.page.locator("html").get_attribute("data-theme") == "dark"
