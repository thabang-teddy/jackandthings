package com.jackandthings.data.local

import com.jackandthings.model.BudgetAccount
import com.jackandthings.model.BudgetCategory
import com.jackandthings.model.BudgetGoal
import com.jackandthings.model.BudgetTransaction
import com.jackandthings.model.Note
import com.jackandthings.model.PomodoroPreset
import com.jackandthings.model.WatchList
import com.jackandthings.model.WorkoutEntry
import com.jackandthings.model.WorkoutPreset
import java.io.File

/**
 * The last list each module successfully read from the server.
 *
 * Kept apart from [LocalStores], which holds rows created while signed out
 * and waiting to be pushed up. These are copies of rows the server already
 * has: they are shown when a request cannot be made, and must never be
 * pushed anywhere, or signing in on a flaky connection would duplicate
 * everything the user owns.
 */
class OfflineCache(dir: File) {

    private val cacheDir = File(dir, "cache").apply { mkdirs() }

    val notes = JsonFileStore(File(cacheDir, "notes.json"), Note.serializer())
    val presets = JsonFileStore(File(cacheDir, "presets.json"), PomodoroPreset.serializer())
    val workoutEntries =
        JsonFileStore(File(cacheDir, "workout_entries.json"), WorkoutEntry.serializer())
    val workoutPresets =
        JsonFileStore(File(cacheDir, "workout_presets.json"), WorkoutPreset.serializer())
    val watchLists = JsonFileStore(File(cacheDir, "watch_lists.json"), WatchList.serializer())
    val budgetAccounts =
        JsonFileStore(File(cacheDir, "budget_accounts.json"), BudgetAccount.serializer())
    val budgetTransactions =
        JsonFileStore(File(cacheDir, "budget_transactions.json"), BudgetTransaction.serializer())
    val budgetCategories =
        JsonFileStore(File(cacheDir, "budget_categories.json"), BudgetCategory.serializer())
    val budgetGoals =
        JsonFileStore(File(cacheDir, "budget_goals.json"), BudgetGoal.serializer())

    /** Signing out must not leave the next account reading these rows. */
    suspend fun clear() {
        notes.write(emptyList())
        presets.write(emptyList())
        workoutEntries.write(emptyList())
        workoutPresets.write(emptyList())
        watchLists.write(emptyList())
        budgetAccounts.write(emptyList())
        budgetTransactions.write(emptyList())
        budgetCategories.write(emptyList())
        budgetGoals.write(emptyList())
    }
}
