<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class NoteRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    /**
     * On create a title is required; on update only the fields present are
     * validated, so the star can be toggled from a list row without that row
     * having to send the whole note back. Same shape as WatchListItemRequest.
     *
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'title' => [$this->isMethod('post') ? 'required' : 'sometimes', 'string', 'max:255'],
            'body' => ['nullable', 'string', 'max:50000'],
            'is_starred' => ['sometimes', 'boolean'],
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

        foreach (['title', 'body'] as $field) {
            if ($this->has($field)) {
                $attributes[$field] = $this->input($field);
            }
        }
        if ($this->has('is_starred')) {
            $attributes['is_starred'] = $this->boolean('is_starred');
        }

        return $attributes;
    }
}
