<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

/** Query parameters shared by the report and due-state reads. */
class BudgetReportRequest extends FormRequest
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
            'period' => ['nullable', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'months' => ['nullable', 'integer', 'between:1,24'],
        ];
    }

    public function period(): string
    {
        return $this->string('period')->value() ?: Carbon::today()->format('Y-m');
    }

    public function months(): int
    {
        return $this->integer('months') ?: 6;
    }
}
