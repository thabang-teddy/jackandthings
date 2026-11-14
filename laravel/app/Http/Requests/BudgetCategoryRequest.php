<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\BudgetCategoryKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class BudgetCategoryRequest extends FormRequest
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
            'name' => [
                $required,
                'string',
                'max:40',
                // One name per user, not globally - two users may both have
                // "Groceries". Ignore the row being edited.
                Rule::unique('budget_categories', 'name')
                    ->where('user_id', $this->user()?->getKey())
                    ->ignore($this->route('category')?->getKey()),
            ],
            'kind' => [$required, Rule::in(BudgetCategoryKind::values())],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'name.unique' => 'You already have a category with that name.',
        ];
    }
}
