<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class HistoryEntryRequest extends FormRequest
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
            'url' => ['required', 'string', 'url', 'max:2048'],
            'title' => ['nullable', 'string', 'max:255'],
            'visited_at' => ['nullable', 'date'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function validatedWithDefaults(): array
    {
        $data = $this->validated();
        $data['visited_at'] ??= now();
        // 'source' is set by the server, not the client: web additions are manual.
        $data['source'] = 'manual';

        return $data;
    }
}
