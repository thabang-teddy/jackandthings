<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetTransactionType;
use App\Enums\RecurringCadence;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RecurringTransactionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * On create everything is required; on update each field is optional so a
     * single attribute (for example `active`) can be toggled without resending
     * the whole schedule.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'account_id' => [
                $required,
                'uuid',
                // Scoped so a caller cannot schedule against somebody else's account.
                Rule::exists('budget_accounts', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'type' => [$required, Rule::in(BudgetTransactionType::directValues())],
            'amount' => [$required, 'numeric', 'min:0.01', 'max:99999999'],
            'description' => ['nullable', 'string', 'max:255'],
            'category_id' => [
                'nullable',
                'uuid',
                Rule::exists('budget_categories', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'cadence' => [$required, Rule::in(RecurringCadence::values())],
            'next_run_at' => [$required, 'date', 'after_or_equal:today'],
            'active' => ['sometimes', 'boolean'],
            // Null means "no reminder"; a non-null value is a bill window.
            'remind_days_before' => ['nullable', 'integer', 'between:0,30'],
        ];
    }

    public function amountCents(): int
    {
        return (int) round($this->float('amount') * 100);
    }

    /**
     * Only the fields actually present, so an update touches nothing it was not
     * given. `amount` is mapped to the stored `amount_cents`.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        if ($this->has('account_id')) {
            $attributes['account_id'] = $this->string('account_id')->value();
        }
        if ($this->has('type')) {
            $attributes['type'] = $this->string('type')->value();
        }
        if ($this->has('amount')) {
            $attributes['amount_cents'] = $this->amountCents();
        }
        if ($this->has('description')) {
            $attributes['description'] = $this->input('description');
        }
        if ($this->has('category_id')) {
            $attributes['category_id'] = $this->input('category_id');
        }
        if ($this->has('cadence')) {
            $attributes['cadence'] = $this->string('cadence')->value();
        }
        if ($this->has('next_run_at')) {
            $attributes['next_run_at'] = $this->date('next_run_at');
        }
        if ($this->has('active')) {
            $attributes['active'] = $this->boolean('active');
        }
        if ($this->has('remind_days_before')) {
            $attributes['remind_days_before'] = $this->input('remind_days_before');
        }

        return $attributes;
    }
}
