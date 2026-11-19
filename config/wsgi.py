"""WSGI entry point. Passenger (GoDaddy) and any WSGI server import `application` from here."""
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.production")
application = get_wsgi_application()
