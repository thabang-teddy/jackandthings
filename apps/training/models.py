from django.conf import settings
from django.db import models

from apps.core.files import user_upload_path
from apps.core.models import OwnedModel


class ExerciseQuerySet(models.QuerySet):
    def visible_to(self, user):
        """The shared library (owner NULL) plus this user's own exercises."""
        return self.filter(models.Q(owner__isnull=True) | models.Q(owner=user))


class Exercise(models.Model):
    """Not an OwnedModel: owner is NULL for the seeded library rows."""

    class Muscle(models.TextChoices):
        LEGS = "legs", "Legs"
        CHEST = "chest", "Chest"
        BACK = "back", "Back"
        SHOULDERS = "shoulders", "Shoulders"
        ARMS = "arms", "Arms"
        CORE = "core", "Core"
        FULL = "full", "Full body"

    class Equipment(models.TextChoices):
        BARBELL = "barbell", "Barbell"
        DUMBBELL = "dumbbell", "Dumbbell"
        MACHINE = "machine", "Machine"
        CABLE = "cable", "Cable"
        BODYWEIGHT = "bodyweight", "Bodyweight"
        OTHER = "other", "Other"

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE,
                              related_name="+")
    name = models.CharField(max_length=80)
    muscle = models.CharField(max_length=10, choices=Muscle.choices)
    equipment = models.CharField(max_length=10, choices=Equipment.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ExerciseQuerySet.as_manager()

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_exercise_name")]

    def __str__(self) -> str:
        return self.name


class Routine(OwnedModel):
    name = models.CharField(max_length=60)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["name"]
        constraints = [models.UniqueConstraint(fields=["owner", "name"], name="uniq_routine_name")]


class RoutineItem(OwnedModel):
    routine = models.ForeignKey(Routine, on_delete=models.CASCADE, related_name="items")
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    position = models.PositiveSmallIntegerField()
    target_sets = models.PositiveSmallIntegerField(default=3)
    target_reps = models.PositiveSmallIntegerField(default=8)
    rest_seconds = models.PositiveSmallIntegerField(default=90)

    class Meta:
        ordering = ["position"]


class WorkoutSession(OwnedModel):
    routine = models.ForeignKey(Routine, null=True, blank=True, on_delete=models.SET_NULL)
    name = models.CharField(max_length=60)
    started_at = models.DateTimeField()
    local_date = models.DateField()
    ended_at = models.DateTimeField(null=True, blank=True)
    rest_until = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    running_key = models.BigIntegerField(null=True, blank=True, unique=True)  # one live session per user

    class Meta:
        ordering = ["-started_at"]
        indexes = [models.Index(fields=["owner", "local_date"])]


class WorkoutSet(OwnedModel):
    session = models.ForeignKey(WorkoutSession, on_delete=models.CASCADE, related_name="sets")
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT, related_name="+")
    position = models.PositiveSmallIntegerField()
    kg_x10 = models.PositiveIntegerField(default=0)  # 77,5 kg is stored as 775
    reps = models.PositiveSmallIntegerField(default=0)
    rest_seconds = models.PositiveSmallIntegerField(default=90)
    done_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["position"]
        indexes = [models.Index(fields=["owner", "exercise"])]


class BodyEntry(OwnedModel):
    date = models.DateField()
    weight_g = models.PositiveIntegerField(null=True, blank=True)
    waist_mm = models.PositiveIntegerField(null=True, blank=True)
    chest_mm = models.PositiveIntegerField(null=True, blank=True)
    hips_mm = models.PositiveIntegerField(null=True, blank=True)
    note = models.CharField(max_length=200, blank=True, default="")

    class Meta:
        ordering = ["-date"]
        constraints = [models.UniqueConstraint(fields=["owner", "date"], name="uniq_body_entry_day")]


class ProgressPhoto(OwnedModel):
    date = models.DateField()
    file = models.FileField(upload_to=user_upload_path, max_length=200)
    content_type = models.CharField(max_length=40)

    class Meta:
        ordering = ["-date", "-id"]
