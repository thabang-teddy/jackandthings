<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetCategoryKind;
use App\Models\BudgetCategory;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class BudgetLimitRequest extends FormRequest
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
            'category_id' => [
                $required,
                'uuid',
                // Scoped so a cap cannot be pinned to somebody else's bucket.
                Rule::exists('budget_categories', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'period' => [$required, 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'limit' => [$required, 'numeric', 'min:0.01', 'max:99999999'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if ($validator->errors()->isNotEmpty() || ! $this->has('category_id')) {
                    return;
                }

                $category = BudgetCategory::query()
                    ->where('user_id', $this->user()?->getKey())
                    ->find($this->string('category_id')->value());

                // A cap on income makes no sense; the form only offers expense
                // buckets, and this keeps an API caller honest.
                if ($category !== null && $category->kind !== BudgetCategoryKind::Expense) {
                    $validator->errors()->add('category_id', 'Limits apply to expense categories only.');
                }
            },
        ];
    }

    public function limitCents(): int
    {
        return (int) round($this->float('limit') * 100);
    }

    /**
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        if ($this->has('category_id')) {
            $attributes['category_id'] = $this->string('category_id')->value();
        }
        if ($this->has('period')) {
            $attributes['period'] = $this->string('period')->value();
        }
        if ($this->has('limit')) {
            $attributes['limit_cents'] = $this->limitCents();
        }

        return $attributes;
    }
}
