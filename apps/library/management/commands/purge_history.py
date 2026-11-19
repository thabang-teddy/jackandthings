from django.core.management.base import BaseCommand

from apps.library.services import purge_all


class Command(BaseCommand):
    help = "Delete browsing history older than each user's retention setting."

    def handle(self, *args, **options):
        self.stdout.write(f"deleted {purge_all()}")
