from django.db import models

from apps.core.models import OwnedModel


class Preset(OwnedModel):
    class AutoStart(models.TextChoices):
        OFF = "off", "Off"
        BREAKS = "breaks", "Breaks"
        FOCUS = "focus", "Focus"
        BOTH = "both", "Both"

    name = models.CharField(max_length=60)
    focus_min = models.PositiveSmallIntegerField(default=25)
    short_min = models.PositiveSmallIntegerField(default=5)
    long_min = models.PositiveSmallIntegerField(default=15)
    long_every = models.PositiveSmallIntegerField(default=4)
    auto_start = models.CharField(max_length=8, choices=AutoStart.choices, default=AutoStart.OFF)
    sound = models.CharField(max_length=20, default="bell")
    strict = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_preset_name")]


class Session(OwnedModel):
    class Phase(models.TextChoices):
        FOCUS = "focus", "Focus"
        SHORT = "short", "Short break"
        LONG = "long", "Long break"

    preset = models.ForeignKey(Preset, null=True, on_delete=models.SET_NULL)
    phase = models.CharField(max_length=8, choices=Phase.choices)
    tag = models.CharField(max_length=40, blank=True, default="")
    cycle_index = models.PositiveSmallIntegerField(default=1)
    started_at = models.DateTimeField()
    local_date = models.DateField()               # see DATABASE.md: why not TruncDate
    planned_seconds = models.PositiveIntegerField()
    paused_at = models.DateTimeField(null=True, blank=True)
    paused_seconds = models.PositiveIntegerField(default=0)
    ended_at = models.DateTimeField(null=True, blank=True)
    completed = models.BooleanField(default=False)
    running_key = models.BigIntegerField(null=True, blank=True, unique=True)  # = owner_id while running

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["owner", "local_date"])]
