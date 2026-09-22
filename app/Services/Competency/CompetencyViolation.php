<?php

namespace App\Services\Competency;

class CompetencyViolation extends \RuntimeException
{
    public function __construct(string $message, public readonly int $status = 422)
    {
        parent::__construct($message);
    }
}
