<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WorkoutReminderSettingRequest extends FormRequest
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
            'target_count' => ['required', 'integer', 'min:1'],
            'activity' => ['nullable', 'string', 'max:100'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i', 'after:start_time'],
            'check_times' => ['required', 'array'],
            'check_times.*' => ['integer', 'min:0', 'max:23'],
            'active' => ['sometimes', 'boolean'],
        ];
    }
}
