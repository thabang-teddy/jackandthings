<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetTransactionType;
use App\Models\BudgetAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BudgetTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'account_id' => [
                'required',
                'uuid',
                // Scoped so a caller cannot post against somebody else's account.
                Rule::exists('budget_accounts', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'type' => ['required', Rule::in(BudgetTransactionType::directValues())],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:99999999'],
            'description' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                if ($this->string('type')->value() !== BudgetTransactionType::Withdrawal->value) {
                    return;
                }

                $account = BudgetAccount::query()
                    ->where('user_id', $this->user()?->getKey())
                    ->find($this->string('account_id')->value());

                if ($account === null) {
                    return;
                }

                if ($account->balanceCents() < $this->amountCents()) {
                    $validator->errors()->add('amount', 'That is more than the account holds.');
                }
            },
        ];
    }

    public function amountCents(): int
    {
        return (int) round($this->float('amount') * 100);
    }

    public function account(): BudgetAccount
    {
        return BudgetAccount::query()
            ->where('user_id', $this->user()?->getKey())
            ->findOrFail($this->string('account_id')->value());
    }
}
