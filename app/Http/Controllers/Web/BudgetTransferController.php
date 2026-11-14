<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Http\Requests\BudgetTransferRequest;
use App\Services\BudgetService;
use Illuminate\Http\RedirectResponse;

class BudgetTransferController extends Controller
{
    public function __construct(private readonly BudgetService $budget) {}

    public function store(BudgetTransferRequest $request): RedirectResponse
    {
        $this->budget->transfer(
            $request->user(),
            $request->fromAccount(),
            $request->toAccount(),
            $request->amountCents(),
            $request->input('description'),
        );

        return back()->with('status', 'Transfer complete.');
    }
}
