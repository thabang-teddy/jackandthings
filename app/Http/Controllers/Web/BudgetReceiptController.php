<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetReceiptRequest;
use App\Models\BudgetReceipt;
use App\Models\BudgetTransaction;
use App\Services\BudgetReceiptStorage;
use Illuminate\Http\RedirectResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Receipt images from the web pages.
 *
 * `file` is the only route to a stored image and it authorizes `view` before
 * streaming a byte - holding the id is not access. The files sit on a private
 * disk with no public URL; see App\Services\BudgetReceiptStorage and
 * docs/SECURITY.md "Uploads".
 */
class BudgetReceiptController extends Controller
{
    use AuthorizesOwnership;

    public function __construct(private readonly BudgetReceiptStorage $storage) {}

    public function store(BudgetReceiptRequest $request, BudgetTransaction $transaction): RedirectResponse
    {
        // `view`, not `update`: the transaction itself is never edited, and its
        // policy deliberately exposes no update ability. The receipt is a
        // separate row that belongs to this user.
        $this->authorizeOwned('view', $transaction);

        $this->storage->store($request->user(), $transaction, $request->file('receipt'));

        return back()->with('status', 'Receipt attached.');
    }

    /**
     * The authorization below is the whole security model for these files.
     */
    public function file(BudgetReceipt $receipt): StreamedResponse
    {
        $this->authorizeOwned('view', $receipt);

        abort_unless($this->storage->exists($receipt), 404);

        return $this->storage->response($receipt);
    }

    /** Deletes the stored image as well as the row. */
    public function destroy(BudgetReceipt $receipt): RedirectResponse
    {
        $this->authorizeOwned('delete', $receipt);

        $receipt->deleteWithFile();

        return back()->with('status', 'Receipt removed.');
    }
}
