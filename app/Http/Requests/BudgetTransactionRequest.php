<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetTransactionType;
use App\Models\BudgetAccount;
use App\Models\BudgetCategory;
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
            'occurred_on' => ['nullable', 'date', 'before_or_equal:today'],
            'merchant' => ['nullable', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:255'],
            'category_id' => [
                'nullable',
                'uuid',
                // A transaction may only name one of the caller's own buckets.
                Rule::exists('budget_categories', 'id')->where('user_id', $this->user()?->getKey()),
            ],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty()) {
                    return;
                }

                $type = BudgetTransactionType::tryFrom($this->string('type')->value());

                if ($type === null) {
                    return;
                }

                $account = BudgetAccount::query()
                    ->where('user_id', $this->user()?->getKey())
                    ->find($this->string('account_id')->value());

                if ($account !== null && $type === BudgetTransactionType::Withdrawal && $account->balanceCents() < $this->amountCents()) {
                    $validator->errors()->add('amount', 'That is more than the account holds.');
                }

                if (! $this->has('category_id') || $this->input('category_id') === null) {
                    return;
                }

                $category = BudgetCategory::query()
                    ->where('user_id', $this->user()?->getKey())
                    ->find($this->string('category_id')->value());

                // An income bucket cannot collect a withdrawal and a spending
                // bucket cannot collect a deposit; the form filters the list,
                // and this keeps an API caller honest.
                if ($category !== null && ! $category->kind->allowsType($type)) {
                    $validator->errors()->add('category_id', 'That category does not match the transaction type.');
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

    public function occurredOn(): ?string
    {
        return $this->date('occurred_on')?->toDateString();
    }

    public function merchant(): ?string
    {
        return $this->input('merchant');
    }

    public function categoryId(): ?string
    {
        return $this->input('category_id');
    }
}
