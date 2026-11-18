from __future__ import annotations

from datetime import datetime, timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import F
from django.utils import timezone

from apps.core.errors import DomainError

from .models import Visit, WatchItem, WatchList


def create_list(owner, name: str) -> WatchList:
    last = WatchList.objects.for_user(owner).order_by("-position").first()
    try:
        with transaction.atomic():
            return WatchList.objects.create(owner=owner, name=name.strip(),
                                            position=(last.position + 1) if last else 0)
    except IntegrityError as exc:
        raise DomainError("You already have a list with that name.", field="name") from exc


def rename_list(wl: WatchList, name: str) -> WatchList:
    if WatchList.objects.for_user(wl.owner).filter(name__iexact=name.strip()).exclude(pk=wl.pk).exists():
        raise DomainError("You already have a list with that name.", field="name")
    wl.name = name.strip()
    wl.save(update_fields=["name", "updated_at"])
    return wl


def add_item(owner, wl: WatchList, *, title: str, url: str = "", note: str = "") -> WatchItem:
    WatchItem.objects.for_user(owner).filter(watch_list=wl).update(position=F("position") + 1)  # new on top
    return WatchItem.objects.create(owner=owner, watch_list=wl, title=title.strip(), url=url, note=note, position=0)


def update_item(item: WatchItem, *, title: str, url: str, note: str, done: bool,
                watch_list: WatchList | None = None) -> WatchItem:
    item.title, item.url, item.note = title.strip(), url, note
    item.done_at = (item.done_at or timezone.now()) if done else None
    if watch_list is not None:
        item.watch_list = watch_list
    item.save()
    return item


# --- History ---------------------------------------------------------------------------------


def clear_range(owner, start: datetime, end: datetime) -> int:
    if end <= start:
        raise DomainError("The end must be after the start.", field="end")
    deleted, _ = Visit.objects.for_user(owner).filter(visited_at__gte=start, visited_at__lt=end).delete()
    return deleted


def purge_for(user, now: datetime | None = None) -> int:
    now = now or timezone.now()
    cutoff = now - timedelta(days=user.history_retention_days)
    deleted, _ = Visit.objects.filter(owner=user, visited_at__lt=cutoff).delete()
    return deleted


def purge_all(now: datetime | None = None) -> int:
    """Cron (nightly): apply every user's retention setting."""
    users = get_user_model().objects.filter(pk__in=Visit.objects.values("owner_id").distinct())
    return sum(purge_for(u, now) for u in users)


def next_purge(user, now: datetime | None = None) -> dict:
    """What tonight's clean-up will remove — shown in the UI, as the design requires."""
    now = now or timezone.now()
    tonight = timezone.localtime(now).replace(hour=3, minute=0, second=0, microsecond=0)
    if tonight <= timezone.localtime(now):
        tonight += timedelta(days=1)
    cutoff = tonight - timedelta(days=user.history_retention_days)
    return {"at": tonight.isoformat(), "count": Visit.objects.filter(owner=user, visited_at__lt=cutoff).count()}
