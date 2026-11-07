<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ClipboardItemRequest extends FormRequest
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
            'title' => ['nullable', 'string', 'max:100'],
            'content' => ['required', 'string', 'max:10000'],
            // Only non-web clients (Android, browser extensions) set this.
            'source_device' => ['nullable', 'string', 'max:30'],
        ];
    }
}
