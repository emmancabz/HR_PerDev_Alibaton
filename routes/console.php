<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('accounts:anonymize-expired')
    ->dailyAt('02:00')
    ->withoutOverlapping();

Artisan::command('performance:provision-reviews', function () {
    app(\App\Services\Performance\PerformanceService::class)->provisionScheduledReviews();
    $this->info('Scheduled review assignments reconciled.');
})->purpose('Provision missing reviews inside their authorized review windows');

Schedule::command('performance:provision-reviews')->dailyAt('00:05')->withoutOverlapping();

Artisan::command('competency:sync-automation', function () {
    $result = app(\App\Services\Competency\CompetencyService::class)->synchronizeAutomation();
    $this->info('Competency automation reconciled: '.json_encode($result, JSON_UNESCAPED_SLASHES));
})->purpose('Reconcile governed Competency cycle, assignment, and reassessment automation');

Schedule::command('competency:sync-automation')
    ->hourly()
    ->withoutOverlapping();
