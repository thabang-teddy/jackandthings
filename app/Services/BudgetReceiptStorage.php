<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\BudgetReceipt;
use App\Models\BudgetTransaction;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The only place in this application that writes a receipt image.
 *
 * This is deliberately a sibling of ProgressPhotoStorage rather than a shared
 * abstraction: the two are separate sets of user files, and merging them would
 * make one module's retention decision silently govern the other. The rules
 * are identical and stated here as well as there:
 *
 * - The private disk only (storage/app/private), never `public`. No public URL,
 *   and `php artisan storage:link` has nothing to do with receipts.
 * - A short allow-list validated with `mimetypes:`, which sniffs the file.
 * - A random stored name with the extension derived from the validated mime,
 *   never from the client's filename.
 * - Reading goes back through a controller that authorizes `view` first.
 * - Deleting the row deletes the file; see BudgetReceipt::deleteWithFile().
 *
 * docs/SECURITY.md "Uploads" is the companion to this class.
 */
class BudgetReceiptStorage
{
    /** The private disk. Not `public` - see the class comment. */
    public const DISK = 'local';

    /** Largest accepted upload, in kilobytes (8 MB). */
    public const MAX_KILOBYTES = 8192;

    /** The only accepted types, as mime => extension. */
    public const ACCEPTED = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/heic' => 'heic',
    ];

    /**
     * Validation rules shared by the FormRequest, so the web form and the API
     * cannot drift apart on what they accept.
     *
     * @return array<int, mixed>
     */
    public static function fileRules(): array
    {
        return [
            'required',
            'file',
            'image',
            'mimetypes:'.implode(',', array_keys(self::ACCEPTED)),
            'max:'.self::MAX_KILOBYTES,
        ];
    }

    /**
     * Stores one receipt for a transaction, replacing any earlier one so the
     * unique transaction index is never the user's problem. `disk`, `path`,
     * `mime` and `size_bytes` all come from the file, which is why they sit
     * outside #[Fillable].
     */
    public function store(User $user, BudgetTransaction $transaction, UploadedFile $file): BudgetReceipt
    {
        $transaction->receipt?->deleteWithFile();

        $mime = $file->getMimeType() ?? 'application/octet-stream';
        $extension = self::ACCEPTED[$mime] ?? null;

        if ($extension === null) {
            throw new \RuntimeException("Refusing to store an unaccepted image type: {$mime}");
        }

        $path = $file->storeAs(
            $this->directoryFor($user),
            bin2hex(random_bytes(16)).'.'.$extension,
            ['disk' => self::DISK]
        );

        if ($path === false) {
            throw new \RuntimeException('Could not write the uploaded receipt to storage.');
        }

        $receipt = new BudgetReceipt(['transaction_id' => $transaction->getKey()]);
        $receipt->disk = self::DISK;
        $receipt->path = $path;
        $receipt->mime = $mime;
        $receipt->size_bytes = $file->getSize() ?: 0;

        $user->budgetReceipts()->save($receipt);

        return $receipt;
    }

    /**
     * Streams the image back. Callers must authorize `view` first - the model
     * is not self-guarding.
     */
    public function response(BudgetReceipt $receipt): StreamedResponse
    {
        return Storage::disk($receipt->disk)->response($receipt->path, null, [
            'Content-Type' => $receipt->mime,
            'Content-Disposition' => 'inline',
            'X-Content-Type-Options' => 'nosniff',
            // Private: a shared cache must never hold a receipt.
            'Cache-Control' => 'private, max-age=300, no-transform',
        ]);
    }

    public function exists(BudgetReceipt $receipt): bool
    {
        return Storage::disk($receipt->disk)->exists($receipt->path);
    }

    /** One directory per user, as progress photos do. */
    private function directoryFor(User $user): string
    {
        return 'budget-receipts/'.$user->getKey();
    }
}
