<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\ProgressPhotoStorage;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * A progress photo upload - the only request in this application that accepts
 * a file.
 *
 * The file rules come from ProgressPhotoStorage so the web form and the API
 * cannot drift apart on what they accept, and so the allow-list lives next to
 * the code that maps a mime type to the extension it will be stored under.
 */
class ProgressPhotoRequest extends FormRequest
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
            'photo' => ProgressPhotoStorage::fileRules(),
            'taken_on' => ['required', 'date', 'before_or_equal:tomorrow'],
            'caption' => ['nullable', 'string', 'max:120'],
            'body_metric_id' => [
                'nullable',
                'uuid',
                // Scoped so a photo cannot be pinned to somebody else's
                // weigh-in.
                Rule::exists('body_metrics', 'id')->where('user_id', $this->user()?->getKey()),
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function messages(): array
    {
        return [
            'photo.mimetypes' => 'Photos must be a JPEG, PNG, WebP or HEIC image.',
            'photo.max' => 'Photos must be smaller than 8 MB.',
        ];
    }

    /**
     * The row's own columns. Nothing about where the file is stored comes from
     * here - the storage service sets disk, path, mime and size from the file
     * itself.
     *
     * @return array<string, mixed>
     */
    public function attributesForModel(): array
    {
        return [
            'taken_on' => $this->date('taken_on')?->toDateString(),
            'caption' => $this->input('caption'),
            'body_metric_id' => $this->input('body_metric_id'),
        ];
    }
}
