"""The ownership base every user-owned table inherits.

Rule: a view NEVER does Model.objects.get(pk=...). It does Model.objects.for_user(request.user).get(pk=...)
(or get_owned), so one user can never read another user's row. Tests in every app prove it.
"""
from __future__ import annotations

from django.conf import settings
from django.db import models
from django.http import Http404


class OwnedQuerySet(models.QuerySet):
    def for_user(self, user):
        """The ONLY way views read owned data. Anonymous users get nothing."""
        if not getattr(user, "is_authenticated", False):
            return self.none()
        return self.filter(owner=user)


class OwnedModel(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = OwnedQuerySet.as_manager()

    class Meta:
        abstract = True


def get_owned(model, user, pk, *, for_update: bool = False):
    """Fetch one row the user owns, or raise 404 (never 403: don't reveal that the row exists)."""
    qs = model.objects.for_user(user)
    if for_update:
        qs = qs.select_for_update()
    try:
        return qs.get(pk=pk)
    except model.DoesNotExist as exc:
        raise Http404 from exc
