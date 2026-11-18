from django.db import models

from apps.core.models import OwnedModel


class Note(OwnedModel):
    title = models.CharField(max_length=120)
    body = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["-updated_at"]
        indexes = [models.Index(fields=["owner", "-updated_at"])]

    def __str__(self) -> str:
        return self.title
