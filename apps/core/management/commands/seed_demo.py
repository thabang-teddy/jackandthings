"""Fill a local database with one user and a little of everything, for looking at the UI.

Development only: it refuses to run unless DEBUG is on. Think of it as a one-off
EF Core seeding routine, except it lives in a command instead of the DbContext.

    python manage.py seed_demo --email you@example.com --password <password>

The password may also come from DEMO_PASSWORD in .env; with neither, one is generated
and printed once.
"""
from __future__ import annotations

import os
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.focus.models import Preset, Session
from apps.library.models import Visit, WatchItem, WatchList
from apps.money import services as money_services
from apps.money.models import Cap, Category, Goal, MoneyAccount, Transaction
from apps.notes.models import Note
from apps.projects import services as project_services
from apps.projects.models import Card, Column, Project
from apps.training.models import Exercise, Routine, RoutineItem, WorkoutSession, WorkoutSet


class Command(BaseCommand):
    help = "Create a demo user with sample data in every module (DEBUG only)."

    def add_arguments(self, parser) -> None:
        parser.add_argument("--email", default="demo@jackandthings.test")
        parser.add_argument("--password", default="")
        parser.add_argument("--name", default="Demo Owner")

    def handle(self, *args, **options) -> None:
        if not settings.DEBUG:
            raise CommandError("seed_demo is for development only (DEBUG is off).")

        email: str = options["email"].lower()
        password: str = options["password"] or os.environ.get("DEMO_PASSWORD", "") or secrets.token_urlsafe(16)

        User = get_user_model()
        user, created = User.objects.get_or_create(
            email=email, defaults={"name": options["name"], "email_verified_at": timezone.now()}
        )
        user.set_password(password)
        if not user.email_verified_at:
            user.email_verified_at = timezone.now()
        user.save()

        self._notes(user)
        self._money(user)
        self._focus(user)
        self._projects(user)
        self._training(user)
        self._library(user)

        verb = "Created" if created else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {email}"))
        self.stdout.write(f"Password: {password}")

    # --- one method per module, so it is obvious what each page will show -------------------

    def _notes(self, user) -> None:
        if Note.objects.for_user(user).exists():
            return
        Note.objects.create(owner=user, title="Daybook", body="Ink on paper. Very little motion.")
        Note.objects.create(owner=user, title="Groceries", body="Oats\nCoffee\nOlive oil")

    def _money(self, user) -> None:
        money_services.ensure_categories(user)
        if MoneyAccount.objects.for_user(user).exists():
            return
        cheque = MoneyAccount.objects.create(owner=user, name="Cheque", kind=MoneyAccount.Kind.CHEQUE,
                                             opening_cents=125_000)
        savings = MoneyAccount.objects.create(owner=user, name="Savings", kind=MoneyAccount.Kind.SAVINGS,
                                              opening_cents=1_840_000)
        today = timezone.localdate()
        groceries = Category.objects.for_user(user).get(name="Groceries")
        transport = Category.objects.for_user(user).get(name="Transport")
        rows = [
            (cheque, groceries, "Woolworths", -84_250, 0),
            (cheque, transport, "Petrol", -110_000, 2),
            (cheque, None, "Salary", 4_200_000, 4),
            (cheque, groceries, "Checkers", -31_780, 6),
            (savings, None, "Interest", 9_640, 7),
        ]
        Transaction.objects.bulk_create([
            Transaction(owner=user, account=account, category=category, date=today - timedelta(days=days_ago),
                        description=description, amount_cents=cents)
            for account, category, description, cents, days_ago in rows
        ])
        Cap.objects.create(owner=user, category=groceries, amount_cents=350_000)
        Goal.objects.create(owner=user, name="Emergency fund", target_cents=5_000_000,
                            target_date=today + timedelta(days=180))

    def _focus(self, user) -> None:
        if Preset.objects.for_user(user).exists():
            return
        preset = Preset.objects.create(owner=user, name="Classic", is_default=True)
        Preset.objects.create(owner=user, name="Deep work", focus_min=50, short_min=10, long_min=25, long_every=3)
        now = timezone.now()
        Session.objects.bulk_create([
            Session(owner=user, preset=preset, phase=Session.Phase.FOCUS, tag="Writing", cycle_index=i + 1,
                    started_at=now - timedelta(days=i, hours=2),
                    local_date=timezone.localtime(now - timedelta(days=i)).date(),
                    planned_seconds=25 * 60, ended_at=now - timedelta(days=i, hours=1, minutes=35), completed=True)
            for i in range(6)
        ])

    def _projects(self, user) -> None:
        if Project.objects.for_user(user).exists():
            return
        website = project_services.create_project(user, name="Website", colour="#0A8F8A")
        project_services.create_project(user, name="Logo refresh", colour="#B0386A")
        columns = {c.name: c for c in Column.objects.for_user(user).filter(project=website)}
        today = timezone.localdate()
        Card.objects.bulk_create([
            Card(owner=user, project=website, column=columns["To do"], title="Daybook tokens in CSS", position=0,
                 due_date=today + timedelta(days=3)),
            Card(owner=user, project=website, column=columns["Doing"], title="Money ledger filters", position=0),
            Card(owner=user, project=website, column=columns["Done"], title="Auth pages", position=0,
                 completed_at=timezone.now()),
        ])

    def _training(self, user) -> None:
        if Routine.objects.for_user(user).exists():
            return
        routine = Routine.objects.create(owner=user, name="Push day")
        wanted = ["Bench press", "Overhead press", "Triceps pushdown"]
        lifts = list(Exercise.objects.filter(owner__isnull=True, name__in=wanted))
        if not lifts:
            return
        RoutineItem.objects.bulk_create([
            RoutineItem(owner=user, routine=routine, exercise=exercise, position=i, target_sets=3, target_reps=8)
            for i, exercise in enumerate(lifts)
        ])
        now = timezone.now()
        session = WorkoutSession.objects.create(owner=user, routine=routine, name="Push day",
                                                started_at=now - timedelta(days=1, hours=1),
                                                local_date=timezone.localtime(now - timedelta(days=1)).date(),
                                                ended_at=now - timedelta(days=1))
        WorkoutSet.objects.bulk_create([
            WorkoutSet(owner=user, session=session, exercise=lifts[0], position=i, kg_x10=600 + i * 50, reps=8,
                       done_at=now - timedelta(days=1, minutes=50 - i * 5))
            for i in range(3)
        ])

    def _library(self, user) -> None:
        if WatchList.objects.for_user(user).exists():
            return
        watch = WatchList.objects.create(owner=user, name="Read later")
        WatchItem.objects.bulk_create([
            WatchItem(owner=user, watch_list=watch, title="Django 5.2 release notes",
                      url="https://docs.djangoproject.com/en/5.2/releases/5.2/", position=0),
            WatchItem(owner=user, watch_list=watch, title="Inertia.js docs", url="https://inertiajs.com/", position=1),
        ])
        now = timezone.now()
        Visit.objects.bulk_create([
            Visit(owner=user, url="https://inertiajs.com/", title="Inertia.js", visited_at=now - timedelta(hours=3)),
            Visit(owner=user, url="https://docs.djangoproject.com/", title="Django docs",
                  visited_at=now - timedelta(hours=5)),
        ])
