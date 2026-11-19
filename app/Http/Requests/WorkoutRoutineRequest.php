<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A routine and its ordered items in one request: the items are what a routine
 * is for, and saving them separately would let a half-built routine exist.
 */
class WorkoutRoutineRequest extends FormRequest
{
    /** More exercises than this in one routine is a mistake, not a workout. */
    public const MAX_ITEMS = 40;

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
            'name' => [$required, 'string', 'max:80'],
            'notes' => ['nullable', 'string', 'max:2000'],

            'items' => [$required, 'array', 'max:'.self::MAX_ITEMS],
            'items.*.exercise_id' => [
                'required',
                'uuid',
                // Scoped to the catalog plus this user's own exercises, so a
                // routine can never reference somebody else's exercise.
                Rule::exists('exercises', 'id')->where(
                    fn ($query) => $query->whereNull('user_id')->orWhere('user_id', $this->user()?->getKey())
                ),
            ],
            'items.*.target_sets' => ['nullable', 'integer', 'min:1', 'max:50'],
            'items.*.target_reps' => ['nullable', 'integer', 'min:1', 'max:500'],
            // Grams, metres, seconds - never a float. 500 kg, 500 km and
            // twelve hours are each far past anything real, which is the point
            // of a ceiling: it catches a unit mix-up, not a strong user.
            'items.*.target_weight_grams' => ['nullable', 'integer', 'min:0', 'max:500000'],
            'items.*.target_distance_metres' => ['nullable', 'integer', 'min:0', 'max:500000'],
            'items.*.target_duration_seconds' => ['nullable', 'integer', 'min:0', 'max:43200'],
            'items.*.rest_seconds' => ['nullable', 'integer', 'min:0', 'max:3600'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            'items.required' => 'A routine needs at least one exercise.',
            'items.*.exercise_id.exists' => 'That exercise is not one you can use.',
        ];
    }

    /**
     * The routine's own columns, without the items.
     *
     * @return array<string, mixed>
     */
    public function routineAttributes(): array
    {
        $attributes = [];

        foreach (['name', 'notes'] as $field) {
            if ($this->has($field)) {
                $attributes[$field] = $this->input($field);
            }
        }

        return $attributes;
    }

    /**
     * The items, with `position` assigned from the order they arrived in
     * rather than taken from the client - the array order *is* the user's
     * chosen order, and a client-supplied position could duplicate or skip.
     *
     * @return array<int, array<string, mixed>>
     */
    public function itemAttributes(): array
    {
        return collect($this->input('items', []))
            ->values()
            ->map(fn (array $item, int $index): array => [
                'exercise_id' => $item['exercise_id'],
                'position' => $index,
                'target_sets' => $item['target_sets'] ?? null,
                'target_reps' => $item['target_reps'] ?? null,
                'target_weight_grams' => $item['target_weight_grams'] ?? null,
                'target_distance_metres' => $item['target_distance_metres'] ?? null,
                'target_duration_seconds' => $item['target_duration_seconds'] ?? null,
                'rest_seconds' => $item['rest_seconds'] ?? null,
            ])
            ->all();
    }
}
