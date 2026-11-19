<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\PomodoroAmbience;
use App\Enums\PomodoroSound;
use App\Enums\PomodoroTicking;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PomodoroPresetRequest extends FormRequest
{
    /** A blocklist longer than this is a mistake, not a preference. */
    private const MAX_BLOCKED_SITES = 50;

    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * Only `name` and `focus_minutes` are required. Everything issue #3 added
     * is optional with a column default behind it, so the three-field payload
     * the Android app and the add-on sent before this change still validates -
     * see docs/ARCHITECTURE.md on the one shared api/v1 contract.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:60'],

            'focus_minutes' => ['required', 'integer', 'min:1', 'max:180'],
            'break_minutes' => ['sometimes', 'integer', 'min:0', 'max:60'],
            'long_break_minutes' => ['sometimes', 'integer', 'min:0', 'max:120'],
            'cycles_before_long_break' => ['sometimes', 'integer', 'min:1', 'max:12'],

            'auto_start_breaks' => ['sometimes', 'boolean'],
            'auto_start_focus' => ['sometimes', 'boolean'],

            'tag' => ['sometimes', 'nullable', 'string', 'max:40'],

            'alarm_sound' => ['sometimes', Rule::in(PomodoroSound::values())],
            'ticking_sound' => ['sometimes', Rule::in(PomodoroTicking::values())],
            'ambience' => ['sometimes', Rule::in(PomodoroAmbience::values())],

            'strict_mode' => ['sometimes', 'boolean'],
            'blocked_sites' => ['sometimes', 'nullable', 'array', 'max:'.self::MAX_BLOCKED_SITES],
            // A host pattern, not a URL: the add-on matches these against a
            // request's hostname, so a scheme or path would never match and is
            // better rejected here than silently ignored there.
            'blocked_sites.*' => ['string', 'max:120', 'regex:/^[A-Za-z0-9*][A-Za-z0-9.*-]*$/'],

            'is_default' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'blocked_sites.*.regex' => 'Each blocked site must be a hostname like example.com or *.example.com.',
        ];
    }

    /**
     * The web form posts the blocklist as one textarea; the API clients post a
     * JSON array. Both arrive here as the array the rules above expect.
     */
    protected function prepareForValidation(): void
    {
        $sites = $this->input('blocked_sites');

        if (is_string($sites)) {
            $this->merge([
                'blocked_sites' => array_values(array_filter(
                    array_map('trim', preg_split('/[\s,]+/', $sites) ?: []),
                    static fn (string $site): bool => $site !== '',
                )),
            ]);
        }
    }
}
