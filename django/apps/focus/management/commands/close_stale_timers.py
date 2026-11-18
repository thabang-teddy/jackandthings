from django.core.management.base import BaseCommand

from apps.focus.services import close_stale
from apps.projects.services import close_stale_entries


class Command(BaseCommand):
    help = "Close focus sessions whose time ran out, and project timers forgotten for 12+ hours."

    def handle(self, *args, **options):
        self.stdout.write(f"focus closed {close_stale()}; project timers closed {close_stale_entries()}")
