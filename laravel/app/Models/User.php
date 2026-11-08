<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

#[Fillable(['name', 'email', 'password'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Every module below is reached through these relations rather than by
     * querying the model directly, so a user can only ever touch their own rows.
     */
    public function pomodoroPresets(): HasMany
    {
        return $this->hasMany(PomodoroPreset::class);
    }

    public function notes(): HasMany
    {
        return $this->hasMany(Note::class);
    }

    public function budgetAccounts(): HasMany
    {
        return $this->hasMany(BudgetAccount::class);
    }

    public function budgetTransactions(): HasMany
    {
        return $this->hasMany(BudgetTransaction::class);
    }

    public function recurringTransactions(): HasMany
    {
        return $this->hasMany(RecurringTransaction::class);
    }

    public function workoutEntries(): HasMany
    {
        return $this->hasMany(WorkoutEntry::class);
    }

    public function workoutPresets(): HasMany
    {
        return $this->hasMany(WorkoutPreset::class);
    }

    public function clipboardItems(): HasMany
    {
        return $this->hasMany(ClipboardItem::class);
    }

    public function historyEntries(): HasMany
    {
        return $this->hasMany(HistoryEntry::class);
    }
}
