<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WatchListItemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * On create the item must name a list the caller owns; on update only the
     * fields present are validated, so `done` can be toggled on its own.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $required = $this->isMethod('post') ? 'required' : 'sometimes';

        return [
            'watch_list_id' => [
                $required,
                'uuid',
                // Scoped so an item cannot be added to somebody else's list.
                Rule::exists('watch_lists', 'id')->where('user_id', $this->user()?->getKey()),
            ],
            'title' => [$required, 'string', 'max:255'],
            'note' => ['nullable', 'string', 'max:1000'],
            'done' => ['sometimes', 'boolean'],
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

        foreach (['watch_list_id', 'title', 'note'] as $field) {
            if ($this->has($field)) {
                $attributes[$field] = $this->input($field);
            }
        }
        if ($this->has('done')) {
            $attributes['done'] = $this->boolean('done');
        }

        return $attributes;
    }
}
