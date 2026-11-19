#!/usr/bin/env python
"""Django's command-line tool for this project (like the `dotnet` CLI)."""
import os
import sys
from pathlib import Path

from dotenv import load_dotenv


def main() -> None:
    # On the server this file sets DJANGO_SETTINGS_MODULE=config.settings.production (cron + SSH).
    # On your laptop it doesn't exist, so the local default below applies.
    load_dotenv(Path.home() / "jackandthings.env")
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    from django.core.management import execute_from_command_line

    execute_from_command_line(sys.argv)


if __name__ == "__main__":
    main()
