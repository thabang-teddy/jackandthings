<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Models\BodyMetric;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

/**
 * A day's body figures. Weight is grams and body fat is permille, so 17.5%
 * arrives as 175 and nothing is lost to rounding; tape measurements are
 * millimetres.
 */
class BodyMetricRequest extends FormRequest
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
            // A reading cannot be in the future, and 'today' is evaluated in
            // the app zone - a client a day ahead of UTC should send its own
            // date, which still passes while the two dates differ by one.
            'measured_on' => [$required, 'date', 'before_or_equal:tomorrow'],
            // 1 g to 500 kg: a ceiling that catches a unit mix-up.
            'weight_grams' => ['nullable', 'integer', 'min:1', 'max:500000'],
            // 0.0% to 100.0% in permille.
            'body_fat_permille' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'measurements' => ['nullable', 'array'],
            'notes' => ['nullable', 'string', 'max:2000'],
            ...$this->siteRules(),
        ];
    }

    /**
     * Each tape site validated by name rather than accepting an open map, so
     * a typo becomes an error instead of a key nothing ever reads again.
     * 10 mm to 3000 mm covers any real measurement.
     *
     * @return array<string, mixed>
     */
    private function siteRules(): array
    {
        $rules = [];

        foreach (BodyMetric::SITES as $site) {
            $rules["measurements.{$site}"] = ['nullable', 'integer', 'min:10', 'max:3000'];
        }

        return $rules;
    }

    /**
     * @return array<string, mixed>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $extra = array_diff(
                    array_keys((array) $this->input('measurements', [])),
                    BodyMetric::SITES
                );

                foreach ($extra as $key) {
                    $validator->errors()->add("measurements.{$key}", 'That is not a measurement site this app records.');
                }
            },
        ];
    }

    /**
     * Only the fields actually present, so an update touches nothing it was
     * not given.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        if ($this->has('measured_on')) {
            $attributes['measured_on'] = $this->date('measured_on')?->toDateString();
        }

        foreach (['weight_grams', 'body_fat_permille'] as $field) {
            if ($this->has($field)) {
                $value = $this->input($field);
                $attributes[$field] = ($value === null || $value === '') ? null : (int) $value;
            }
        }

        if ($this->has('notes')) {
            $attributes['notes'] = $this->input('notes');
        }

        if ($this->has('measurements')) {
            // Blank sites are dropped rather than stored as null, so the json
            // holds only what was actually measured.
            $attributes['measurements'] = collect((array) $this->input('measurements', []))
                ->only(BodyMetric::SITES)
                ->reject(fn (mixed $value): bool => $value === null || $value === '')
                ->map(fn (mixed $value): int => (int) $value)
                ->all();
        }

        return $attributes;
    }

    /**
     * The unique index on (user_id, measured_on) means a second reading for a
     * day replaces the first. This is the key the controller upserts on.
     */
    public function dayKey(): string
    {
        return (string) $this->date('measured_on')?->toDateString();
    }
}
