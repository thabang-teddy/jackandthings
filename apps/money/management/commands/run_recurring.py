from django.core.management.base import BaseCommand

from apps.money.services import run_due


class Command(BaseCommand):
    help = "Post auto-post recurring items that are due. Safe to run more than once a day."

    def handle(self, *args, **options):
        self.stdout.write(f"posted {run_due()}")
