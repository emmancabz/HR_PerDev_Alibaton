<?php

namespace App\Contracts\Training;

use App\Models\Training\TrainingSession;
use App\Models\User;

interface WorkforceAttendanceGateway
{
    /**
     * Return supporting workforce evidence only. Training attendance remains a
     * separate HR-finalized record and must never be inferred as final here.
     *
     * @return array{status:string, externalId:?string, snapshot:array<string,mixed>, error:?string}
     */
    public function evidence(TrainingSession $session, User $participant): array;
}
