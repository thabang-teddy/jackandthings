from django.contrib import admin

from .models import Card, CardNote, Column, Project, TimeEntry

for model in (Project, Column, Card, CardNote, TimeEntry):
    admin.site.register(model)
