<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Concerns\AuthorizesOwnership;
use App\Http\Controllers\Controller;
use App\Http\Requests\BodyMetricRequest;
use App\Http\Resources\BodyMetricPayload;
use App\Http\Resources\ProgressPhotoPayload;
use App\Models\BodyMetric;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BodyMetricController extends Controller
{
    use AuthorizesOwnership;

    /** Readings returned before paging would be wanted. */
    private const RECENT = 180;

    public function index(Request $request): JsonResponse
    {
        $metrics = $request->user()
            ->bodyMetrics()
            ->with('photos')
            ->orderByDesc('measured_on')
            ->limit(self::RECENT)
            ->get();

        return response()->json([
            'data' => BodyMetricPayload::collection($metrics, ProgressPhotoPayload::API_FILE_ROUTE),
        ]);
    }

    public function show(BodyMetric $metric): JsonResponse
    {
        $this->authorizeOwned('view', $metric);

        return response()->json([
            'data' => BodyMetricPayload::from($metric->load('photos'), ProgressPhotoPayload::API_FILE_ROUTE),
        ]);
    }

    /**
     * There is one reading per day, so a POST for a day that already has one
     * updates it rather than failing on the unique index. Logging your weight
     * twice in a morning is a correction, not an error.
     */
    public function store(BodyMetricRequest $request): JsonResponse
    {
        $attributes = $request->attributesForModel();

        $existing = $request->user()
            ->bodyMetrics()
            ->where('measured_on', $request->dayKey())
            ->first();

        if ($existing !== null) {
            $existing->update($attributes);

            return response()->json([
                'data' => BodyMetricPayload::from($existing->load('photos'), ProgressPhotoPayload::API_FILE_ROUTE),
            ]);
        }

        $metric = $request->user()->bodyMetrics()->create($attributes);

        return response()->json([
            'data' => BodyMetricPayload::from($metric->load('photos'), ProgressPhotoPayload::API_FILE_ROUTE),
        ], 201);
    }

    public function update(BodyMetricRequest $request, BodyMetric $metric): JsonResponse
    {
        $this->authorizeOwned('update', $metric);

        $metric->update($request->attributesForModel());

        return response()->json([
            'data' => BodyMetricPayload::from($metric->load('photos'), ProgressPhotoPayload::API_FILE_ROUTE),
        ]);
    }

    /**
     * Photos taken that day are kept, not deleted with the reading - the
     * migration nulls their body_metric_id. Deleting a weigh-in should not
     * silently destroy a photo.
     */
    public function destroy(BodyMetric $metric): JsonResponse
    {
        $this->authorizeOwned('delete', $metric);

        $metric->delete();

        return response()->json(status: 204);
    }
}
