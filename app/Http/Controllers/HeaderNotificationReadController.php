<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class HeaderNotificationReadController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user, 401);

        $validated = $request->validate([
            'notifications' => ['required', 'array', 'max:50'],
            'notifications.*.id' => ['required', 'string', 'max:120'],
            'notifications.*.fingerprint' => ['required', 'string', 'size:64', 'regex:/^[a-f0-9]{64}$/i'],
        ]);

        if (! Schema::hasTable('header_notification_reads')) {
            return response()->json([
                'message' => 'Notification read tracking is not available yet.',
            ], 503);
        }

        $now = now();
        $rows = collect($validated['notifications'])
            ->unique('id')
            ->map(fn (array $notification): array => [
                'user_id' => $user->id,
                'notification_id' => $notification['id'],
                'fingerprint' => strtolower($notification['fingerprint']),
                'read_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ])
            ->values()
            ->all();

        if ($rows !== []) {
            DB::table('header_notification_reads')->upsert(
                $rows,
                ['user_id', 'notification_id'],
                ['fingerprint', 'read_at', 'updated_at'],
            );
        }

        return response()->json([
            'message' => 'Notification read state updated.',
            'markedRead' => count($rows),
        ]);
    }
}
