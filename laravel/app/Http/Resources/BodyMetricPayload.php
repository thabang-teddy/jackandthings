<?php

declare(strict_types=1);

namespace App\Http\Resources;

use App\Models\BodyMetric;

/**
 * A day's body figures. Integers on the wire exactly as they are in the
 * database - grams, permille, millimetres - so no surface has to agree with
 * another about rounding. The clients format kilograms and percentages for
 * display.
 */
final class BodyMetricPayload
{
    /**
     * @return array<string, mixed>
     */
    public static function from(BodyMetric $metric, string $fileRoute = ProgressPhotoPayload::WEB_FILE_ROUTE): array
    {
        return [
            'id' => $metric->id,
            'measured_on' => $metric->measured_on?->toDateString(),
            'weight_grams' => $metric->weight_grams,
            'body_fat_permille' => $metric->body_fat_permille,
            'measurements' => $metric->measurements ?? [],
            'notes' => $metric->notes,
            'photos' => $metric->relationLoaded('photos')
                ? ProgressPhotoPayload::collection($metric->photos, $fileRoute)
                : [],
        ];
    }

    /**
     * @param  iterable<BodyMetric>  $metrics
     * @return array<int, array<string, mixed>>
     */
    public static function collection(iterable $metrics, string $fileRoute = ProgressPhotoPayload::WEB_FILE_ROUTE): array
    {
        $payload = [];
        foreach ($metrics as $metric) {
            $payload[] = self::from($metric, $fileRoute);
        }

        return $payload;
    }
}
