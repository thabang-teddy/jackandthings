from django.contrib import admin

from .models import BodyEntry, Exercise, ProgressPhoto, Routine, RoutineItem, WorkoutSession, WorkoutSet

for model in (Exercise, Routine, RoutineItem, WorkoutSession, WorkoutSet, BodyEntry, ProgressPhoto):
    admin.site.register(model)
