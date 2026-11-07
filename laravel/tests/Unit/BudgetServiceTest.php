<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Enums\BudgetTransactionType;
use App\Exceptions\InsufficientFundsException;
use App\Models\BudgetAccount;
use App\Models\BudgetTransaction;
use App\Models\User;
use App\Services\BudgetService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * The money rules.
 *
 * Balances are derived from the ledger rather than stored, so most of what
 * matters here is that the ledger stays honest: transfers write both legs or
 * neither, overdrafts are refused, and deleting half a transfer is impossible.
 */
class BudgetServiceTest extends TestCase
{
    use RefreshDatabase;

    private BudgetService $budget;

    private User $user;

    private BudgetAccount $cash;

    private BudgetAccount $savings;

    protected function setUp(): void
    {
        parent::setUp();

        $this->budget = app(BudgetService::class);
        $this->user = User::factory()->create();
        $this->cash = $this->user->budgetAccounts()->create(['name' => 'Cash']);
        $this->savings = $this->user->budgetAccounts()->create(['name' => 'Savings']);
    }

    public function test_a_deposit_raises_the_balance(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000, 'Payday');

        $this->assertSame(50_000, $this->cash->balanceCents());
    }

    public function test_a_withdrawal_lowers_the_balance(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000);
        $this->budget->withdraw($this->user, $this->cash, 12_550);

        $this->assertSame(37_450, $this->cash->balanceCents());
    }

    public function test_a_withdrawal_beyond_the_balance_is_refused(): void
    {
        $this->budget->deposit($this->user, $this->cash, 10_000);

        $this->expectException(InsufficientFundsException::class);

        try {
            $this->budget->withdraw($this->user, $this->cash, 10_001);
        } finally {
            // The refusal must leave the ledger untouched, not merely report.
            $this->assertSame(10_000, $this->cash->balanceCents());
            $this->assertSame(1, $this->user->budgetTransactions()->count());
        }
    }

    public function test_a_withdrawal_of_exactly_the_balance_is_allowed(): void
    {
        $this->budget->deposit($this->user, $this->cash, 10_000);
        $this->budget->withdraw($this->user, $this->cash, 10_000);

        $this->assertSame(0, $this->cash->balanceCents());
    }

    public function test_a_transfer_writes_both_legs_under_one_group(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000);
        $this->budget->transfer($this->user, $this->cash, $this->savings, 20_000, 'Monthly saving');

        $this->assertSame(30_000, $this->cash->balanceCents());
        $this->assertSame(20_000, $this->savings->balanceCents());

        $legs = BudgetTransaction::query()->whereNotNull('transfer_group_id')->get();
        $this->assertCount(2, $legs);
        $this->assertCount(1, $legs->pluck('transfer_group_id')->unique());

        $out = $legs->firstWhere('type', BudgetTransactionType::TransferOut);
        $in = $legs->firstWhere('type', BudgetTransactionType::TransferIn);

        $this->assertSame($this->cash->getKey(), $out->account_id);
        $this->assertSame($this->savings->getKey(), $out->related_account_id);
        $this->assertSame($this->savings->getKey(), $in->account_id);
        $this->assertSame($this->cash->getKey(), $in->related_account_id);
    }

    public function test_a_transfer_beyond_the_balance_writes_nothing(): void
    {
        $this->budget->deposit($this->user, $this->cash, 5_000);

        try {
            $this->budget->transfer($this->user, $this->cash, $this->savings, 5_001);
            $this->fail('expected the transfer to be refused');
        } catch (InsufficientFundsException) {
            // A half-written transfer would be far worse than a refused one.
            $this->assertSame(0, BudgetTransaction::query()->whereNotNull('transfer_group_id')->count());
            $this->assertSame(5_000, $this->cash->balanceCents());
            $this->assertSame(0, $this->savings->balanceCents());
        }
    }

    public function test_deleting_one_leg_of_a_transfer_removes_its_counterpart(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000);
        $this->budget->transfer($this->user, $this->cash, $this->savings, 20_000);

        $leg = BudgetTransaction::query()->whereNotNull('transfer_group_id')->firstOrFail();
        $this->budget->deleteTransaction($leg);

        $this->assertSame(0, BudgetTransaction::query()->whereNotNull('transfer_group_id')->count());
        $this->assertSame(50_000, $this->cash->balanceCents());
        $this->assertSame(0, $this->savings->balanceCents());
    }

    public function test_deleting_a_plain_transaction_removes_only_that_one(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000);
        $withdrawal = $this->budget->withdraw($this->user, $this->cash, 10_000);

        $this->budget->deleteTransaction($withdrawal);

        $this->assertSame(50_000, $this->cash->balanceCents());
        $this->assertSame(1, $this->user->budgetTransactions()->count());
    }

    public function test_balances_for_covers_every_account_in_one_query(): void
    {
        $this->budget->deposit($this->user, $this->cash, 50_000);
        $this->budget->withdraw($this->user, $this->cash, 12_550);
        $this->budget->transfer($this->user, $this->cash, $this->savings, 10_000);

        DB::enableQueryLog();
        $balances = $this->budget->balancesFor($this->user);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame(27_450, $balances[$this->cash->getKey()]);
        $this->assertSame(10_000, $balances[$this->savings->getKey()]);

        // The dashboard lists every account, so this must not grow with them.
        $this->assertCount(1, $queries, 'balancesFor should issue exactly one query');
    }

    public function test_an_account_with_no_transactions_has_a_zero_balance(): void
    {
        $this->assertSame(0, $this->cash->balanceCents());
        $this->assertSame([], $this->budget->balancesFor($this->user));
    }

    public function test_transactions_are_owned_by_the_acting_user_not_the_request(): void
    {
        $transaction = $this->budget->deposit($this->user, $this->cash, 1_000);

        $this->assertSame($this->user->getKey(), $transaction->user_id);
    }
}
