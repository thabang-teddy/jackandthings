<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class PomodoroPresetRequest extends FormRequest
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
            'name' => ['required', 'string', 'max:60'],
            'focus_minutes' => ['required', 'integer', 'min:1', 'max:180'],
            'break_minutes' => ['required', 'integer', 'min:0', 'max:60'],
            'is_default' => ['sometimes', 'boolean'],
        ];
    }
}
