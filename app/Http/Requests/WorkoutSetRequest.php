<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * One logged set.
 *
 * Every measure is optional on its own but the set must carry at least one of
 * them - a row with no numbers in it is not a set, and would quietly skew the
 * records and the volume totals by counting as an entry with nothing in it.
 */
class WorkoutSetRequest extends FormRequest
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
            'exercise_id' => [
                $required,
                'uuid',
                // The catalog plus this user's own exercises, nobody else's.
                Rule::exists('exercises', 'id')->where(
                    fn ($query) => $query->whereNull('user_id')->orWhere('user_id', $this->user()?->getKey())
                ),
            ],
            'is_warmup' => ['sometimes', 'boolean'],
            'reps' => ['nullable', 'integer', 'min:1', 'max:500'],
            // Integers in grams, metres and seconds. The ceilings are there to
            // catch a unit mix-up - somebody sending kilograms into a grams
            // field - not to doubt a strong user.
            'weight_grams' => ['nullable', 'integer', 'min:0', 'max:500000'],
            'distance_metres' => ['nullable', 'integer', 'min:0', 'max:500000'],
            'duration_seconds' => ['nullable', 'integer', 'min:0', 'max:43200'],
            'rpe' => ['nullable', 'integer', 'min:1', 'max:10'],
            'completed_at' => ['sometimes', 'date'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                if (! $this->isMethod('post')) {
                    return;
                }

                $measures = ['reps', 'weight_grams', 'distance_metres', 'duration_seconds'];
                $given = array_filter(
                    $measures,
                    fn (string $field): bool => $this->input($field) !== null && $this->input($field) !== ''
                );

                if ($given === []) {
                    $validator->errors()->add('reps', 'A set needs at least one of reps, weight, distance or time.');
                }
            },
        ];
    }

    /**
     * Only the fields actually present. `position` is not accepted from the
     * client: the controller assigns it from the session's current set count,
     * so two sets logged from two devices cannot claim the same slot.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        if ($this->has('exercise_id')) {
            $attributes['exercise_id'] = $this->input('exercise_id');
        }

        foreach (['reps', 'weight_grams', 'distance_metres', 'duration_seconds', 'rpe'] as $field) {
            if ($this->has($field)) {
                $value = $this->input($field);
                $attributes[$field] = ($value === null || $value === '') ? null : (int) $value;
            }
        }

        if ($this->has('is_warmup')) {
            $attributes['is_warmup'] = $this->boolean('is_warmup');
        }

        $attributes['completed_at'] = $this->has('completed_at')
            ? Carbon::parse($this->string('completed_at')->value())->utc()
            : Carbon::now('UTC');

        return $attributes;
    }
}
