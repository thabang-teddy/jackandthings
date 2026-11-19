from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_GET
from inertia import render as inertia_render

from . import selectors


@login_required
@require_GET
def index(request):
    return inertia_render(request, "Today/Index", props=selectors.today(request.user))
