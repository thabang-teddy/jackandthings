<?php

declare(strict_types=1);

namespace Tests\Feature\Api;

use App\Models\BudgetAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The api/v1 contract the Android app and the browser add-on are written
 * against. Both clients decode these exact shapes, so a change here breaks
 * them silently — hence pinning the envelope and the field names, not just
 * the status codes.
 */
class ApiContractTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create(['password' => bcrypt('password1234')]);
    }

    private function signedIn(): static
    {
        Sanctum::actingAs($this->user);

        return $this;
    }

    // ── Auth ───────────────────────────────────────────────────────────────

    public function test_a_token_is_issued_for_correct_credentials(): void
    {
        $response = $this->postJson('/api/v1/auth/token', [
            'email' => $this->user->email,
            'password' => 'password1234',
            'device_name' => 'Pixel 8',
        ]);

        $response->assertCreated()
            ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email']]]);

        $this->assertDatabaseHas('personal_access_tokens', [
            'tokenable_id' => $this->user->id,
            'name' => 'Pixel 8',
        ]);
    }

    public function test_a_wrong_password_is_refused_without_revealing_whether_the_account_exists(): void
    {
        $wrongPassword = $this->postJson('/api/v1/auth/token', [
            'email' => $this->user->email,
            'password' => 'not-the-password',
            'device_name' => 'Pixel 8',
        ])->assertStatus(422);

        $unknownEmail = $this->postJson('/api/v1/auth/token', [
            'email' => 'nobody@example.test',
            'password' => 'not-the-password',
            'device_name' => 'Pixel 8',
        ])->assertStatus(422);

        // Identical wording either way, so the endpoint cannot be used to
        // discover which addresses have accounts.
        $this->assertSame(
            $wrongPassword->json('errors.email'),
            $unknownEmail->json('errors.email'),
        );
        $this->assertSame(0, \DB::table('personal_access_tokens')->count());
    }

    public function test_the_api_is_closed_without_a_token(): void
    {
        foreach (['/api/v1/notes', '/api/v1/budget-accounts', '/api/v1/auth/me'] as $endpoint) {
            $this->getJson($endpoint)->assertUnauthorized();
        }
    }

    public function test_signing_out_revokes_only_the_calling_token(): void
    {
        $keep = $this->user->createToken('other device')->plainTextToken;
        $drop = $this->user->createToken('this device')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$drop}")
            ->deleteJson('/api/v1/auth/token')
            ->assertNoContent();

        // The row is gone, which is the behaviour that matters.
        $this->assertDatabaseCount('personal_access_tokens', 1);
        $this->assertDatabaseHas('personal_access_tokens', ['name' => 'other device']);

        // A guard that already resolved a user keeps serving it for the rest
        // of the test, so without this the next request would pass on a
        // cached identity rather than on the revoked token.
        $this->forgetAuthGuards();

        $this->withHeader('Authorization', "Bearer {$drop}")
            ->getJson('/api/v1/notes')
            ->assertUnauthorized();

        $this->forgetAuthGuards();

        $this->withHeader('Authorization', "Bearer {$keep}")
            ->getJson('/api/v1/notes')
            ->assertOk();
    }

    private function forgetAuthGuards(): void
    {
        $this->app['auth']->forgetGuards();
    }

    // ── Modules ────────────────────────────────────────────────────────────

    public function test_notes_round_trip(): void
    {
        $created = $this->signedIn()
            ->postJson('/api/v1/notes', ['title' => 'Shopping', 'body' => 'Milk'])
            ->assertCreated()
            ->json('data');

        $this->signedIn()->getJson('/api/v1/notes')
            ->assertOk()
            ->assertJsonPath('data.0.title', 'Shopping');

        $this->signedIn()
            ->putJson("/api/v1/notes/{$created['id']}", ['title' => 'Groceries'])
            ->assertOk()
            ->assertJsonPath('data.title', 'Groceries');

        $this->signedIn()->deleteJson("/api/v1/notes/{$created['id']}")->assertNoContent();
        $this->assertDatabaseCount('notes', 0);
    }

    public function test_a_note_without_a_title_is_rejected(): void
    {
        $this->signedIn()
            ->postJson('/api/v1/notes', ['body' => 'no title'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('title');
    }

    public function test_budget_accounts_report_a_derived_balance_and_the_currency(): void
    {
        $account = $this->user->budgetAccounts()->create(['name' => 'Cash']);

        $this->signedIn()->postJson('/api/v1/budget-transactions', [
            'account_id' => $account->id,
            'type' => 'deposit',
            'amount' => '500.00',
        ])->assertCreated();

        $this->signedIn()->getJson('/api/v1/budget-accounts')
            ->assertOk()
            ->assertJsonPath('data.0.balance_cents', 50_000)
            ->assertJsonPath('meta.currency', 'ZAR');
    }

    public function test_an_amount_is_converted_to_cents_without_floating_point_drift(): void
    {
        $account = $this->user->budgetAccounts()->create(['name' => 'Cash']);

        $this->signedIn()->postJson('/api/v1/budget-transactions', [
            'account_id' => $account->id,
            'type' => 'deposit',
            'amount' => '125.50',
        ])->assertCreated()->assertJsonPath('data.amount_cents', 12_550);
    }

    public function test_an_overdraft_is_refused_by_validation(): void
    {
        $account = $this->user->budgetAccounts()->create(['name' => 'Cash']);

        $this->signedIn()->postJson('/api/v1/budget-transactions', [
            'account_id' => $account->id,
            'type' => 'withdrawal',
            'amount' => '1.00',
        ])->assertStatus(422)->assertJsonValidationErrors('amount');
    }

    public function test_a_transaction_cannot_be_posted_against_someone_elses_account(): void
    {
        $theirs = BudgetAccount::factory()->for(User::factory())->create();

        $this->signedIn()->postJson('/api/v1/budget-transactions', [
            'account_id' => $theirs->id,
            'type' => 'deposit',
            'amount' => '10.00',
        ])->assertStatus(422)->assertJsonValidationErrors('account_id');

        $this->assertDatabaseCount('budget_transactions', 0);
    }

    public function test_a_transfer_moves_money_between_two_of_my_accounts(): void
    {
        $from = $this->user->budgetAccounts()->create(['name' => 'Cash']);
        $to = $this->user->budgetAccounts()->create(['name' => 'Savings']);

        $this->signedIn()->postJson('/api/v1/budget-transactions', [
            'account_id' => $from->id, 'type' => 'deposit', 'amount' => '500.00',
        ])->assertCreated();

        $this->signedIn()->postJson('/api/v1/budget-transfers', [
            'from_account_id' => $from->id,
            'to_account_id' => $to->id,
            'amount' => '100.00',
        ])->assertNoContent();

        $this->assertSame(40_000, $from->balanceCents());
        $this->assertSame(10_000, $to->balanceCents());
    }

    public function test_a_transfer_to_the_same_account_is_refused(): void
    {
        $account = $this->user->budgetAccounts()->create(['name' => 'Cash']);

        $this->signedIn()->postJson('/api/v1/budget-transfers', [
            'from_account_id' => $account->id,
            'to_account_id' => $account->id,
            'amount' => '1.00',
        ])->assertStatus(422)->assertJsonValidationErrors('to_account_id');
    }

    public function test_account_names_are_unique_per_user_but_not_globally(): void
    {
        $this->user->budgetAccounts()->create(['name' => 'Cash']);

        $this->signedIn()->postJson('/api/v1/budget-accounts', ['name' => 'Cash'])
            ->assertStatus(422)->assertJsonValidationErrors('name');

        // Somebody else naming an account "Cash" is none of our business.
        $other = User::factory()->create();
        Sanctum::actingAs($other);
        $this->postJson('/api/v1/budget-accounts', ['name' => 'Cash'])->assertCreated();
    }

    public function test_the_due_endpoint_reports_state_and_sends_nothing(): void
    {
        $this->signedIn()->getJson('/api/v1/workout-entries/due')
            ->assertOk()
            ->assertJsonPath('data.due', true)
            ->assertJsonPath('data.last_logged_at', null);

        $this->signedIn()->postJson('/api/v1/workout-entries', ['activity' => 'Run'])
            ->assertCreated();

        $this->signedIn()->getJson('/api/v1/workout-entries/due')
            ->assertOk()
            ->assertJsonPath('data.due', false);
    }

    public function test_the_due_route_is_not_shadowed_by_the_show_route(): void
    {
        // workout-entries/due must win over workout-entries/{workout};
        // registration order is the only thing keeping it that way.
        $this->signedIn()->getJson('/api/v1/workout-entries/due')
            ->assertOk()
            ->assertJsonStructure(['data' => ['due']]);
    }

    public function test_clipboard_items_keep_the_device_that_saved_them(): void
    {
        $this->signedIn()->postJson('/api/v1/clipboard-items', [
            'content' => 'copy me',
            'source_device' => 'Pixel 8',
        ])->assertCreated()->assertJsonPath('data.source_device', 'Pixel 8');
    }

    public function test_history_reports_the_retention_window_the_clients_rely_on(): void
    {
        $this->signedIn()->postJson('/api/v1/history-entries', [
            'url' => 'https://example.test/page',
            'title' => 'Example',
        ])->assertCreated()->assertJsonPath('data.source', 'manual');

        // The add-on reads this to decide what to clear locally.
        $this->signedIn()->getJson('/api/v1/history-entries')
            ->assertOk()
            ->assertJsonPath('meta.retention_days', 90);
    }

    public function test_a_history_entry_needs_a_real_url(): void
    {
        $this->signedIn()->postJson('/api/v1/history-entries', ['url' => 'not a url'])
            ->assertStatus(422)->assertJsonValidationErrors('url');
    }

    public function test_history_entries_cannot_be_edited_only_added_or_removed(): void
    {
        $entry = $this->user->historyEntries()->create([
            'url' => 'https://example.test/page',
            'visited_at' => now(),
            'source' => 'manual',
        ]);

        $this->signedIn()
            ->putJson("/api/v1/history-entries/{$entry->id}", ['url' => 'https://evil.test'])
            ->assertStatus(405);
    }

    public function test_pomodoro_presets_round_trip(): void
    {
        $preset = $this->signedIn()->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Deep work',
            'focus_minutes' => 50,
            'break_minutes' => 10,
        ])->assertCreated()->json('data');

        $this->assertSame(50, $preset['focus_minutes']);

        $this->signedIn()->deleteJson("/api/v1/pomodoro-presets/{$preset['id']}")
            ->assertNoContent();
    }

    public function test_a_preset_longer_than_three_hours_is_refused(): void
    {
        $this->signedIn()->postJson('/api/v1/pomodoro-presets', [
            'name' => 'Marathon',
            'focus_minutes' => 181,
            'break_minutes' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors('focus_minutes');
    }

    public function test_user_id_cannot_be_set_from_the_request_body(): void
    {
        $victim = User::factory()->create();

        $note = $this->signedIn()->postJson('/api/v1/notes', [
            'title' => 'mine',
            'user_id' => $victim->id,
        ])->assertCreated()->json('data');

        // Ownership comes from the token, never the payload.
        $this->assertDatabaseHas('notes', ['id' => $note['id'], 'user_id' => $this->user->id]);
    }
}
