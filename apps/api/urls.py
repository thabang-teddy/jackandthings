"""`/api/v1/…` — the same route table as `laravel/routes/api.php`, in the same order.

Routes with a fixed word where an id could go ("stats", "current", "due") are declared
before the resource they belong to, exactly as the Laravel file does, so "stats" is
never read as a record id.
"""
from django.urls import path

from . import views_auth, views_focus, views_library, views_money, views_notes, views_training

app_name = "v1"

urlpatterns = [
    # --- Auth
    path("auth/token", views_auth.token_endpoint, name="auth-token"),   # POST issues, DELETE revokes
    path("auth/me", views_auth.me, name="auth-me"),

    # --- Notes
    path("notes", views_notes.notes, name="notes"),
    path("notes/<int:pk>", views_notes.note, name="note"),

    # --- Focus (Pomodoro)
    path("pomodoro-presets", views_focus.presets, name="presets"),
    path("pomodoro-presets/<int:pk>", views_focus.preset, name="preset"),
    path("pomodoro-sessions/stats", views_focus.stats, name="pomodoro-stats"),
    path("pomodoro-sessions", views_focus.sessions, name="pomodoro-sessions"),
    path("pomodoro-sessions/<int:pk>", views_focus.session, name="pomodoro-session"),

    # --- Library
    path("watch-lists", views_library.watch_lists, name="watch-lists"),
    path("watch-lists/<int:pk>", views_library.watch_list, name="watch-list"),
    path("watch-list-items", views_library.watch_items, name="watch-list-items"),
    path("watch-list-items/<int:pk>", views_library.watch_item, name="watch-list-item"),
    path("history-entries", views_library.history_entries, name="history-entries"),
    path("history-entries/<int:pk>", views_library.history_entry, name="history-entry"),

    # --- Training
    path("exercises/<int:pk>/history", views_training.exercise_history, name="exercise-history"),
    path("exercises", views_training.exercises, name="exercises"),
    path("exercises/<int:pk>", views_training.exercise, name="exercise"),
    path("workout-routines", views_training.routines, name="routines"),
    path("workout-routines/<int:pk>", views_training.routine, name="routine"),
    path("workout-sessions/current", views_training.current_workout, name="workout-current"),
    path("workout-sessions/<int:pk>/finish", views_training.finish_workout, name="workout-finish"),
    path("workout-sessions/<int:pk>/sets", views_training.session_sets, name="workout-sets"),
    path("workout-sessions", views_training.workout_sessions, name="workout-sessions"),
    path("workout-sessions/<int:pk>", views_training.workout_session, name="workout-session"),
    path("workout-sets/<int:pk>", views_training.workout_set, name="workout-set"),
    path("body-metrics", views_training.body_metrics, name="body-metrics"),
    path("body-metrics/<int:pk>", views_training.body_metric, name="body-metric"),
    path("progress-photos/<int:pk>/file", views_training.progress_photo_file, name="progress-photo-file"),
    path("progress-photos", views_training.progress_photos, name="progress-photos"),
    path("progress-photos/<int:pk>", views_training.progress_photo, name="progress-photo"),
    path("workout-stats", views_training.stats, name="workout-stats"),

    # --- Money
    path("budget-accounts", views_money.accounts, name="accounts"),
    path("budget-accounts/<int:pk>", views_money.account, name="account"),
    path("budget-transactions/<int:pk>/receipt", views_money.receipt_upload, name="receipt-upload"),
    path("budget-transactions", views_money.transactions, name="transactions"),
    path("budget-transactions/<int:pk>", views_money.transaction, name="transaction"),
    path("budget-transfers", views_money.transfers, name="transfers"),
    path("budget-receipts/<int:pk>/file", views_money.receipt_file, name="receipt-file"),
    path("budget-receipts/<int:pk>", views_money.receipt, name="receipt"),
    path("budget-categories", views_money.categories, name="categories"),
    path("budget-categories/<int:pk>", views_money.category, name="category"),
    path("budget-limits", views_money.caps, name="caps"),
    path("budget-limits/<int:pk>", views_money.cap, name="cap"),
    path("budget-goals/<int:pk>/contribute", views_money.goal_contribute, name="goal-contribute"),
    path("budget-goals", views_money.goals, name="goals"),
    path("budget-goals/<int:pk>", views_money.goal, name="goal"),
    path("recurring-transactions/<int:pk>/confirm", views_money.recurring_confirm, name="recurring-confirm"),
    path("recurring-transactions/<int:pk>/skip", views_money.recurring_skip, name="recurring-skip"),
    path("recurring-transactions", views_money.recurring_items, name="recurring-items"),
    path("recurring-transactions/<int:pk>", views_money.recurring_item, name="recurring-item"),
    path("budget-reports", views_money.reports, name="reports"),
    path("budget-due", views_money.due, name="due"),
]
