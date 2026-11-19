<?php

declare(strict_types=1);

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class WatchListRequest extends FormRequest
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
            'name' => [
                'required',
                'string',
                'max:60',
                // The table has a (user_id, name) unique index, so validate it
                // here rather than letting a duplicate surface as a 500.
                Rule::unique('watch_lists', 'name')
                    ->where('user_id', $this->user()?->getKey())
                    ->ignore($this->route('watchList')?->getKey()),
            ],
        ];
    }
}
