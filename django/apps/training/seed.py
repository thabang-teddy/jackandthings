"""The shared exercise library. Loaded by a data migration — see migrations/README.md."""

SEED = [
    ("Back squat", "legs", "barbell"), ("Front squat", "legs", "barbell"),
    ("Romanian deadlift", "legs", "barbell"), ("Deadlift", "back", "barbell"),
    ("Leg press", "legs", "machine"), ("Walking lunge", "legs", "dumbbell"),
    ("Bench press", "chest", "barbell"), ("Incline dumbbell press", "chest", "dumbbell"),
    ("Push-up", "chest", "bodyweight"), ("Barbell row", "back", "barbell"),
    ("Pull-up", "back", "bodyweight"), ("Lat pulldown", "back", "cable"),
    ("Seated cable row", "back", "cable"), ("Overhead press", "shoulders", "barbell"),
    ("Lateral raise", "shoulders", "dumbbell"), ("Barbell curl", "arms", "barbell"),
    ("Triceps pushdown", "arms", "cable"), ("Plank", "core", "bodyweight"),
    ("Hanging leg raise", "core", "bodyweight"), ("Kettlebell swing", "full", "other"),
]


def seed(apps, schema_editor):
    Exercise = apps.get_model("training", "Exercise")  # the historical model, not an import
    Exercise.objects.bulk_create([Exercise(name=n, muscle=m, equipment=e) for n, m, e in SEED])


def unseed(apps, schema_editor):
    Exercise = apps.get_model("training", "Exercise")
    Exercise.objects.filter(owner__isnull=True, name__in=[n for n, _, _ in SEED]).delete()
