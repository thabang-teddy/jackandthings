<?php

declare(strict_types=1);

namespace App\Http\Controllers\Web;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BodyMetricRequest;
use App\Models\BodyMetric;
use Illuminate\Http\RedirectResponse;

class BodyMetricController extends Controller
{
    use AuthorizesOwnership;

    /**
     * One reading per day, so saving a day that already has one updates it
     * rather than failing on the unique index. Weighing yourself twice in a
     * morning is a correction, not an error.
     */
    public function store(BodyMetricRequest $request): RedirectResponse
    {
        // whereDate, not a plain equality - see the API controller for why.
        $existing = $request->user()
            ->bodyMetrics()
            ->whereDate('measured_on', $request->dayKey())
            ->first();

        if ($existing !== null) {
            $existing->update($request->attributesForModel());

            return back()->with('status', "Updated that day's figures.");
        }

        $request->user()->bodyMetrics()->create($request->attributesForModel());

        return back()->with('status', 'Measurements saved.');
    }

    public function update(BodyMetricRequest $request, BodyMetric $metric): RedirectResponse
    {
        $this->authorizeOwned('update', $metric);

        $metric->update($request->attributesForModel());

        return back()->with('status', 'Measurements updated.');
    }

    /**
     * Photos taken that day survive - the migration nulls their
     * body_metric_id rather than cascading. Deleting a weigh-in should not
     * silently destroy a photo.
     */
    public function destroy(BodyMetric $metric): RedirectResponse
    {
        $this->authorizeOwned('delete', $metric);

        $metric->delete();

        return back()->with('status', 'Measurements deleted.');
    }
}
