<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Enums\ExerciseCategory;
use App\Enums\ExerciseMetric;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * A user's own exercise. The seeded catalog is never written through here -
 * ExercisePolicy refuses an update on a row with no owner.
 */
class ExerciseRequest extends FormRequest
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
            'name' => [$required, 'string', 'max:120'],
            'category' => [$required, Rule::in(ExerciseCategory::values())],
            'metric' => [$required, Rule::in(ExerciseMetric::values())],
            'primary_muscle' => ['nullable', 'string', 'max:60'],
            'equipment' => ['nullable', 'string', 'max:60'],
            'instructions' => ['nullable', 'string', 'max:4000'],
            'cues' => ['nullable', 'array', 'max:12'],
            // Nullable because Laravel's TrimStrings and
            // ConvertEmptyStringsToNull reach the payload first: a cue the
            // user left blank arrives here as null, not as "". Rejecting it
            // would mean a stray empty line in a textarea fails the whole
            // save; attributesForModel() drops it instead.
            'cues.*' => ['nullable', 'string', 'max:160'],
        ];
    }

    /**
     * Only the fields actually present, so an update touches nothing it was
     * not given.
     *
     * The slug is derived from the name here rather than accepted from the
     * client: it is only used to keep one user from saving the same exercise
     * twice, and letting a caller choose it would let them collide with the
     * catalog's slugs on purpose.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        foreach (['name', 'category', 'metric', 'primary_muscle', 'equipment', 'instructions'] as $field) {
            if ($this->has($field)) {
                $attributes[$field] = $this->input($field);
            }
        }

        if ($this->has('name')) {
            $attributes['slug'] = Str::limit(Str::slug($this->string('name')->value()), 130, '');
        }

        if ($this->has('cues')) {
            // Dropped blanks rather than stored: an empty cue renders as an
            // empty bullet, which reads as a bug.
            $attributes['cues'] = collect($this->input('cues', []))
                ->map(fn (mixed $cue): string => trim((string) $cue))
                ->filter()
                ->values()
                ->all();
        }

        return $attributes;
    }
}
