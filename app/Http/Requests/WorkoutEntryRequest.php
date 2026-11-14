<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;

class WorkoutEntryRequest extends FormRequest
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
            'activity' => ['required', 'string', 'max:100'],
            'logged_at' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * Clients send an absolute ISO-8601 instant, so the offset it carries is
     * what decides the moment. Without converting here, a value such as
     * "20:00+02:00" is stored as 20:00 UTC and read back two hours late, while
     * the omitted-value default is a true UTC instant - the two paths used to
     * disagree for the same real moment.
     *
     * @return array<string, mixed>
     */
    public function validatedWithDefaults(): array
    {
        $data = $this->validated();

        $data['logged_at'] = isset($data['logged_at'])
            ? Carbon::parse($data['logged_at'])->utc()
            : Carbon::now('UTC');

        return $data;
    }
}
