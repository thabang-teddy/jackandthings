<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ApiTokenRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

/**
 * Token issuance for non-browser clients (Android app, browser extensions).
 * The web app itself uses Breeze's session guard, not these endpoints.
 */
class AuthController extends Controller
{
    public function store(ApiTokenRequest $request): JsonResponse
    {
        $user = User::query()->where('email', $request->string('email')->value())->first();

        // Same message either way, so this cannot be used to discover which
        // email addresses have accounts.
        if ($user === null || ! Hash::check($request->string('password')->value(), $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $token = $user->createToken($request->string('device_name')->value());

        return response()->json([
            'data' => [
                'token' => $token->plainTextToken,
                'user' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
            ],
        ], 201);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email],
        ]);
    }

    /**
     * Revokes only the token used for this request, leaving the user's other
     * devices signed in.
     */
    public function destroy(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(status: 204);
    }
}
