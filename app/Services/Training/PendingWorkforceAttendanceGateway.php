<?php

namespace App\Services\Training;

use App\Contracts\Training\WorkforceAttendanceGateway;
use App\Models\Training\TrainingSession;
use App\Models\User;

class PendingWorkforceAttendanceGateway implements WorkforceAttendanceGateway
{
    public function evidence(TrainingSession $session, User $participant): array
    {
        return [
            'status' => 'Not Connected',
            'externalId' => null,
            'snapshot' => [
                'contractVersion' => config('training.workforce_attendance.contract_version'),
                'sourceSystem' => config('training.workforce_attendance.source_system'),
                'personnelKey' => $participant->personnel_key,
                'sessionStartsAt' => $session->starts_at?->toIso8601String(),
                'sessionEndsAt' => $session->ends_at?->toIso8601String(),
            ],
            'error' => config('training.workforce_attendance.source_system').' has not supplied an attendance endpoint yet.',
        ];
    }
}
