<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetAccountKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BudgetAccountRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'max:60',
                // Account names are unique per user, not globally.
                Rule::unique('budget_accounts', 'name')
                    ->where('user_id', $this->user()?->getKey())
                    ->ignore($this->route('account')?->getKey()),
            ],
            'kind' => ['sometimes', Rule::in(BudgetAccountKind::values())],
            'opening_balance' => ['sometimes', 'numeric', 'min:0', 'max:99999999'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'You already have an account with that name.',
        ];
    }

    /**
     * `opening_balance` is the major-unit figure the user typed; the column is
     * integer cents, and the conversion happens exactly once, here.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = ['name' => $this->string('name')->value()];

        if ($this->has('kind')) {
            $attributes['kind'] = $this->string('kind')->value();
        }
        if ($this->has('opening_balance')) {
            $attributes['opening_balance_cents'] = (int) round($this->float('opening_balance') * 100);
        }

        return $attributes;
    }
}
