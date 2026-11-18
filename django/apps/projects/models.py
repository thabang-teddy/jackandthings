from django.db import models

from apps.core.models import OwnedModel

DEFAULT_COLUMNS = ["Backlog", "To do", "Doing", "Review", "Done"]


class Project(OwnedModel):
    name = models.CharField(max_length=80)
    colour = models.CharField(max_length=7, default="#1F4FD1")
    due_date = models.DateField(null=True, blank=True)
    archived = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_project_name")]


class Column(OwnedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="columns")
    name = models.CharField(max_length=40)
    position = models.PositiveIntegerField()
    wip_limit = models.PositiveSmallIntegerField(null=True, blank=True)

    class Meta:
        ordering = ["position"]
        indexes = [models.Index(fields=["project", "position"])]


class Card(OwnedModel):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="cards")
    column = models.ForeignKey(Column, on_delete=models.PROTECT, related_name="cards")
    title = models.CharField(max_length=160)
    description = models.TextField(blank=True, default="")
    due_date = models.DateField(null=True, blank=True)
    position = models.PositiveIntegerField(default=0)
    labels = models.JSONField(default=list, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["position"]
        indexes = [models.Index(fields=["owner", "column", "position"]), models.Index(fields=["owner", "due_date"])]


class CardNote(OwnedModel):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="notes")
    body = models.TextField()

    class Meta:
        ordering = ["-created_at"]


class TimeEntry(OwnedModel):
    card = models.ForeignKey(Card, on_delete=models.CASCADE, related_name="time_entries")
    started_at = models.DateTimeField()
    local_date = models.DateField()
    stopped_at = models.DateTimeField(null=True, blank=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    paused_seconds = models.PositiveIntegerField(default=0)
    seconds = models.PositiveIntegerField(null=True, blank=True)
    running_key = models.BigIntegerField(null=True, blank=True, unique=True)  # one running entry per user

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["owner", "local_date"])]
