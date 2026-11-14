<?php

declare(strict_types=1);

namespace App\Http\Requests;

use App\Services\BudgetReceiptStorage;
use Illuminate\Foundation\Http\FormRequest;

/**
 * A receipt upload. The file rules come from BudgetReceiptStorage so the web
 * form and the API cannot drift apart on what they accept, exactly as
 * ProgressPhotoRequest does for progress photos.
 */
class BudgetReceiptRequest extends FormRequest
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
            'receipt' => BudgetReceiptStorage::fileRules(),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'receipt.mimetypes' => 'Receipts must be a JPEG, PNG, WebP or HEIC image.',
            'receipt.max' => 'Receipts must be smaller than 8 MB.',
        ];
    }
}
