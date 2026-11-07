<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\BudgetAccount;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BudgetTransferRequest extends FormRequest
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
            // Both sides are scoped to the caller: you can only move your own money
            // between your own accounts.
            'from_account_id' => [
                'required',
                'uuid',
                Rule::exists('budget_accounts', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'to_account_id' => [
                'required',
                'uuid',
                'different:from_account_id',
                Rule::exists('budget_accounts', 'id')->where('user_id', $this->user()?->getKey()),
            ],
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

                $from = $this->accountOrNull($this->string('from_account_id')->value());

                if ($from !== null && $from->balanceCents() < $this->amountCents()) {
                    $validator->errors()->add('amount', 'That is more than the source account holds.');
                }
            },
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'to_account_id.different' => 'Pick two different accounts.',
        ];
    }

    public function amountCents(): int
    {
        return (int) round($this->float('amount') * 100);
    }

    public function fromAccount(): BudgetAccount
    {
        return $this->accountOrFail($this->string('from_account_id')->value());
    }

    public function toAccount(): BudgetAccount
    {
        return $this->accountOrFail($this->string('to_account_id')->value());
    }

    private function accountOrNull(string $id): ?BudgetAccount
    {
        return BudgetAccount::query()
            ->where('user_id', $this->user()?->getKey())
            ->find($id);
    }

    private function accountOrFail(string $id): BudgetAccount
    {
        return BudgetAccount::query()
            ->where('user_id', $this->user()?->getKey())
            ->findOrFail($id);
    }
}
