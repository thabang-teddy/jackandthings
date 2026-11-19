from django.db import models

from apps.core.models import OwnedModel


class WatchList(OwnedModel):
    name = models.CharField(max_length=60)
    position = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ["position", "name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_watchlist_name")]


class WatchItem(OwnedModel):
    watch_list = models.ForeignKey(WatchList, on_delete=models.CASCADE, related_name="items")
    title = models.CharField(max_length=200)
    url = models.URLField(max_length=2048, blank=True, default="")
    note = models.CharField(max_length=300, blank=True, default="")
    done_at = models.DateTimeField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["done_at", "position"]


class Visit(OwnedModel):
    url = models.URLField(max_length=2048)
    title = models.CharField(max_length=300, blank=True, default="")
    visited_at = models.DateTimeField()

    class Meta:
        ordering = ["-visited_at"]
        indexes = [models.Index(fields=["owner", "-visited_at"])]


class ApiToken(OwnedModel):
    name = models.CharField(max_length=60, default="Browser extension")
    token_hash = models.CharField(max_length=64, unique=True)  # sha256 hex; the raw token is never stored
    last_used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
