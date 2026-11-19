<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class WorkoutSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * A session is created when the workout starts and updated when it ends,
     * so `finished_at` is only ever sent on an update.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'workout_routine_id' => [
                'nullable',
                'uuid',
                // Scoped: a session cannot claim somebody else's routine.
                Rule::exists('workout_routines', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'started_at' => ['sometimes', 'date'],
            'finished_at' => ['sometimes', 'nullable', 'date', 'after_or_equal:started_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    /**
     * Only the fields actually present. Timestamps are converted to UTC for
     * the same reason WorkoutEntryRequest does it: a client sends an absolute
     * instant, and the offset it carries is what decides the moment. Without
     * the conversion, "20:00+02:00" would be stored as 20:00 UTC and read
     * back two hours late.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        $attributes = [];

        if ($this->has('workout_routine_id')) {
            $attributes['workout_routine_id'] = $this->input('workout_routine_id');
        }

        if ($this->has('notes')) {
            $attributes['notes'] = $this->input('notes');
        }

        if ($this->has('started_at')) {
            $attributes['started_at'] = Carbon::parse($this->string('started_at')->value())->utc();
        }

        if ($this->has('finished_at')) {
            $finished = $this->input('finished_at');
            $attributes['finished_at'] = $finished === null
                ? null
                : Carbon::parse((string) $finished)->utc();
        }

        return $attributes;
    }

    /** A session started with no `started_at` starts now. */
    public function startedAt(): Carbon
    {
        return $this->has('started_at')
            ? Carbon::parse($this->string('started_at')->value())->utc()
            : Carbon::now('UTC');
    }
}
