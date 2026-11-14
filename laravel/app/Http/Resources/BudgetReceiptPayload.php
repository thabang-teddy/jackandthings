<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BudgetReceipt;

/**
 * A receipt's record. `disk` and `path` are deliberately absent: a client has
 * no use for where the file sits, and the image is fetched from `url`, whose
 * action authorizes `view` before a byte is streamed.
 */
final class BudgetReceiptPayload
{
    public const WEB_FILE_ROUTE = 'budget-receipts.file';

    public const API_FILE_ROUTE = 'api.v1.budget-receipts.file';

    /**
     * @return array<string, mixed>
     */
    public static function from(BudgetReceipt $receipt, string $fileRoute = self::WEB_FILE_ROUTE): array
    {
        return [
            'id' => $receipt->id,
            'transaction_id' => $receipt->transaction_id,
            'mime' => $receipt->mime,
            'size_bytes' => $receipt->size_bytes,
            'url' => route($fileRoute, $receipt),
        ];
    }
}
