<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BudgetGoalRequest extends FormRequest
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
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'name' => [$required, 'string', 'max:60'],
            'target' => [$required, 'numeric', 'min:0.01', 'max:99999999'],
            'saved' => ['sometimes', 'numeric', 'min:0', 'max:99999999'],
            'account_id' => [
                'nullable',
                'uuid',
                // A goal may name where its money comes from, but only one of
                // the caller's own accounts.
                Rule::exists('budget_accounts', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'target_date' => ['nullable', 'date'],
            'archived' => ['sometimes', 'boolean'],
        ];
    }

    public function targetCents(): int
    {
        return (int) round($this->float('target') * 100);
    }

    public function savedCents(): int
    {
        return (int) round($this->float('saved') * 100);
    }

    /**
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        foreach (['name', 'account_id', 'target_date'] as $field) {
            if ($this->has($field)) {
                $attributes[$field] = $this->input($field);
            }
        }

        if ($this->has('target')) {
            $attributes['target_cents'] = $this->targetCents();
        }
        if ($this->has('saved')) {
            $attributes['saved_cents'] = $this->savedCents();
        }
        if ($this->has('archived')) {
            $attributes['archived_at'] = $this->boolean('archived') ? now() : null;
        }

        return $attributes;
    }
}
