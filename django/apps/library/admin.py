from django.contrib import admin

from .models import ApiToken, Visit, WatchItem, WatchList

admin.site.register(WatchList)
admin.site.register(WatchItem)
admin.site.register(Visit)


@admin.register(ApiToken)
class ApiTokenAdmin(admin.ModelAdmin):
    list_display = ("owner", "name", "created_at", "last_used_at")
    readonly_fields = ("token_hash",)
