"""Exercises, routines, live workouts, sets, body entries and photos.

Weights cross the wire in grams and are stored in tenths of a kilogram, so most of these
tests are really about that conversion surviving a round trip.
"""
import pytest

from apps.training.models import BodyEntry, Exercise, ProgressPhoto, Routine, WorkoutSession, WorkoutSet

from .conftest import data, errors, png_upload


@pytest.fixture
def bench(db):
    return Exercise.objects.create(name="Bench press", muscle="chest", equipment="barbell")


@pytest.fixture
def routine(api, alice, bench):
    return data(api.post("workout-routines", {
        "name": "Push day",
        "items": [{"exercise_id": str(bench.pk), "target_sets": 2, "target_reps": 5,
                   "rest_seconds": 60}]}))


# --- Exercises ------------------------------------------------------------------------------------


def test_the_library_is_the_shared_rows_plus_your_own(api, alice, bob, bench):
    Exercise.objects.create(owner=alice, name="My lift", muscle="back", equipment="cable")
    Exercise.objects.create(owner=bob, name="Their lift", muscle="back", equipment="cable")
    names = [row["name"] for row in data(api.get("exercises"))]
    assert "Bench press" in names and "My lift" in names and "Their lift" not in names


def test_a_created_exercise_is_marked_custom(api, alice):
    body = data(api.post("exercises", {"name": "Sled push", "category": "legs", "equipment": "other"}))
    assert body["is_custom"] is True and body["category_label"] == "Legs"
    assert Exercise.objects.get(name="Sled push").owner == alice


def test_a_duplicate_name_is_422(api, bench):
    response = api.post("exercises", {"name": "bench press", "category": "chest"})
    assert response.status_code == 422 and "name" in errors(response)


def test_a_shared_exercise_is_read_only(api, bench):
    assert api.get(f"exercises/{bench.pk}").status_code == 200
    assert api.put(f"exercises/{bench.pk}", {"name": "Renamed"}).status_code == 403
    assert api.delete(f"exercises/{bench.pk}").status_code == 403
    bench.refresh_from_db()
    assert bench.name == "Bench press"


def test_your_own_exercise_can_be_changed_and_removed(api, alice):
    row = data(api.post("exercises", {"name": "Sled push", "category": "legs"}))
    assert data(api.put(f"exercises/{row['id']}", {"name": "Sled drag"}))["name"] == "Sled drag"
    assert api.delete(f"exercises/{row['id']}").status_code == 204


def test_another_users_exercise_is_404(api, bob):
    theirs = Exercise.objects.create(owner=bob, name="Theirs", muscle="back", equipment="cable")
    assert api.get(f"exercises/{theirs.pk}").status_code == 404


def test_history_lists_finished_sessions_and_the_best_lift(api, alice, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    api.post(f"workout-sessions/{workout['id']}/sets",
             {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 60_000})
    api.post(f"workout-sessions/{workout['id']}/finish")

    body = data(api.get(f"exercises/{bench.pk}/history"))
    assert body["exercise_id"] == str(bench.pk)
    assert body["sessions"][0]["routine_name"] == "Push day"
    assert body["best"]["best_weight_grams"] == 60_000
    assert body["best"]["best_one_rep_max_grams"] > 60_000      # Epley, five reps


# --- Routines -------------------------------------------------------------------------------------


def test_a_routine_keeps_its_items_in_order(api, alice, bench):
    squat = Exercise.objects.create(name="Back squat", muscle="legs", equipment="barbell")
    body = data(api.post("workout-routines", {"name": "Lower", "items": [
        {"exercise_id": str(squat.pk), "target_sets": 3, "target_reps": 5},
        {"exercise_id": str(bench.pk), "target_sets": 2, "target_reps": 8}]}))
    assert [item["exercise_name"] for item in body["items"]] == ["Back squat", "Bench press"]
    assert body["items"][0]["target_sets"] == 3


def test_a_routine_cannot_use_another_users_exercise(api, bob):
    theirs = Exercise.objects.create(owner=bob, name="Theirs", muscle="back", equipment="cable")
    response = api.post("workout-routines", {"name": "Sneaky",
                                             "items": [{"exercise_id": str(theirs.pk)}]})
    assert response.status_code == 422 and Routine.objects.count() == 0


def test_a_routine_needs_at_least_one_exercise(api):
    assert api.post("workout-routines", {"name": "Empty", "items": []}).status_code == 422


def test_renaming_a_routine_keeps_its_items(api, routine):
    body = data(api.put(f"workout-routines/{routine['id']}", {"name": "Push A"}))
    assert body["name"] == "Push A" and len(body["items"]) == 1


# --- Workouts and sets ------------------------------------------------------------------------------


def test_starting_from_a_routine_lays_out_its_sets(api, alice, routine):
    body = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    assert body["is_open"] is True and body["set_count"] == 2      # target_sets from the routine
    assert WorkoutSession.objects.get(owner=alice).running_key == alice.pk


def test_only_one_workout_runs_at_a_time(api, routine):
    api.post("workout-sessions", {"workout_routine_id": routine["id"]})
    assert api.post("workout-sessions", {"workout_routine_id": routine["id"]}).status_code == 422


def test_current_is_null_until_one_is_running(api, routine):
    assert data(api.get("workout-sessions/current")) is None
    api.post("workout-sessions", {"workout_routine_id": routine["id"]})
    assert data(api.get("workout-sessions/current"))["is_open"] is True


def test_logging_a_set_converts_grams_to_tenths_of_a_kilo(api, alice, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    body = data(api.post(f"workout-sessions/{workout['id']}/sets",
                         {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 77_500}))
    assert body["weight_grams"] == 77_500 and body["volume_grams"] == 387_500
    assert WorkoutSet.objects.get(pk=body["id"]).kg_x10 == 775


def test_the_first_logged_set_is_a_record(api, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    first = data(api.post(f"workout-sessions/{workout['id']}/sets",
                          {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 60_000}))
    heavier = data(api.post(f"workout-sessions/{workout['id']}/sets",
                            {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 65_000}))
    lighter = data(api.post(f"workout-sessions/{workout['id']}/sets",
                            {"exercise_id": str(bench.pk), "reps": 3, "weight_grams": 50_000}))
    assert first["is_record"] is True and heavier["is_record"] is True
    assert lighter["is_record"] is False


def test_changing_a_set(api, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    logged = data(api.post(f"workout-sessions/{workout['id']}/sets",
                           {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 60_000}))
    body = data(api.put(f"workout-sets/{logged['id']}", {"reps": 6, "weight_grams": 62_500}))
    assert body["reps"] == 6 and body["weight_grams"] == 62_500


def test_finishing_drops_the_sets_that_were_never_logged(api, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    api.post(f"workout-sessions/{workout['id']}/sets",
             {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 60_000})
    body = data(api.post(f"workout-sessions/{workout['id']}/finish", {"notes": "good one"}))
    assert body["is_open"] is False and body["notes"] == "good one"
    assert body["set_count"] == 1 and body["duration_seconds"] is not None


def test_finishing_an_empty_workout_is_refused(api, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    assert api.post(f"workout-sessions/{workout['id']}/finish").status_code == 422


def test_another_users_workout_is_404(api, bob):
    theirs = WorkoutSession.objects.create(owner=bob, name="Theirs", started_at="2026-11-18T06:00:00+02:00",
                                           local_date="2026-11-18")
    assert api.get(f"workout-sessions/{theirs.pk}").status_code == 404
    assert api.post(f"workout-sessions/{theirs.pk}/finish").status_code == 404


def test_stats_summarise_the_logged_volume(api, bench, routine):
    workout = data(api.post("workout-sessions", {"workout_routine_id": routine["id"]}))
    api.post(f"workout-sessions/{workout['id']}/sets",
             {"exercise_id": str(bench.pk), "reps": 5, "weight_grams": 60_000})
    api.post(f"workout-sessions/{workout['id']}/finish")

    body = data(api.get("workout-stats"))
    assert body["today"]["sets"] == 1 and body["today"]["volume_grams"] == 300_000
    assert body["streak_days"] == 1 and body["sessions_this_week"] == 1
    assert body["categories"][0]["category"] == "chest"
    assert len(body["days"]) == 7 and len(body["calendar"]) == 90
    assert body["records"][0]["exercise_name"] == "Bench press"


# --- Body entries and photos --------------------------------------------------------------------------


def test_a_body_entry_takes_centimetres_and_stores_millimetres(api, alice):
    body = data(api.post("body-metrics", {"measured_on": "2026-11-17", "weight_grams": 81_200,
                                          "measurements": {"waist": 84}, "notes": "morning"}))
    assert body["measurements"] == {"waist": 84} and body["weight_grams"] == 81_200
    assert BodyEntry.objects.get(owner=alice).waist_mm == 840


def test_a_second_entry_for_the_same_day_updates_the_first(api, alice):
    api.post("body-metrics", {"measured_on": "2026-11-17", "weight_grams": 81_200})
    api.post("body-metrics", {"measured_on": "2026-11-17", "weight_grams": 80_900})
    assert BodyEntry.objects.count() == 1
    assert BodyEntry.objects.get().weight_g == 80_900


def test_a_date_that_is_not_a_date_is_422(api):
    response = api.post("body-metrics", {"measured_on": "yesterday"})
    assert response.status_code == 422 and "measured_on" in errors(response)


def test_another_users_body_entry_is_404(api, bob):
    theirs = BodyEntry.objects.create(owner=bob, date="2026-11-17", weight_g=70_000)
    assert api.get(f"body-metrics/{theirs.pk}").status_code == 404
    assert api.delete(f"body-metrics/{theirs.pk}").status_code == 404


def test_a_photo_is_uploaded_and_only_its_owner_can_fetch_it(api, api_bob, alice, settings, tmp_path):
    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    body = data(api.upload("progress-photos", file=png_upload(), taken_on="2026-11-17"))
    assert body["mime"] == "image/png" and body["size_bytes"] > 0
    assert ProgressPhoto.objects.get(owner=alice).file.name.startswith(f"u{alice.pk}/progressphoto/")

    assert api.get(f"progress-photos/{body['id']}/file").status_code == 200
    assert api_bob.get(f"progress-photos/{body['id']}/file").status_code == 404   # ISO-05


def test_a_photo_that_is_not_an_image_is_refused(api, settings, tmp_path):
    settings.PRIVATE_MEDIA_ROOT = settings.MEDIA_ROOT = tmp_path
    from django.core.files.uploadedfile import SimpleUploadedFile

    bad = SimpleUploadedFile("x.png", b"<script>alert(1)</script>", content_type="image/png")
    assert api.upload("progress-photos", file=bad).status_code == 422
    assert ProgressPhoto.objects.count() == 0


def test_a_photo_upload_without_a_file_is_422(api):
    response = api.upload("progress-photos", taken_on="2026-11-17")
    assert response.status_code == 422 and "file" in errors(response)
