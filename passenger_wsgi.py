"""Entry point for Phusion Passenger on GoDaddy cPanel.

Passenger imports this file and calls `application(environ, start_response)` for each request.
"""
import os
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent
sys.path.insert(0, str(BASE))  # so `import config` works
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")

from config.wsgi import application  # noqa: E402,F401  (must come after the path setup)
