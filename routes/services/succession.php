<?php

use App\Http\Controllers\SuccessionStateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['internal.service:succession', 'throttle:120,1'])->prefix('succession/api')->name('succession.api.')->group(function (): void {
    Route::get('/state', [SuccessionStateController::class, 'show'])->name('state');
    Route::post('/positions', [SuccessionStateController::class, 'createPosition'])->name('positions.create');
    Route::put('/positions/{position}', [SuccessionStateController::class, 'updatePosition'])->name('positions.update');
    Route::post('/positions/{position}/transition', [SuccessionStateController::class, 'transitionPosition'])->name('positions.transition');
    Route::post('/positions/{position}/candidates', [SuccessionStateController::class, 'nominate'])->name('candidates.create');
    Route::post('/candidates/{candidate}/transition', [SuccessionStateController::class, 'transitionCandidate'])->name('candidates.transition');
    Route::post('/candidates/{candidate}/assessments', [SuccessionStateController::class, 'createAssessment'])->name('assessments.create');
    Route::put('/assessments/{assessment}', [SuccessionStateController::class, 'updateAssessment'])->name('assessments.update');
    Route::post('/assessments/{assessment}/finalize', [SuccessionStateController::class, 'finalizeAssessment'])->name('assessments.finalize');
    Route::post('/assessments/{assessment}/reopen', [SuccessionStateController::class, 'reopenAssessment'])->name('assessments.reopen');
    Route::post('/candidates/{candidate}/plans', [SuccessionStateController::class, 'createPlan'])->name('plans.create');
    Route::post('/plans/{plan}/transition', [SuccessionStateController::class, 'transitionPlan'])->name('plans.transition');
    Route::post('/plans/{plan}/actions', [SuccessionStateController::class, 'createAction'])->name('actions.create');
    Route::put('/plans/{plan}/actions/{action}', [SuccessionStateController::class, 'updateAction'])->name('actions.update');
    Route::post('/evidence', [SuccessionStateController::class, 'receiveEvidence'])->name('evidence.receive');
    Route::get('/reports/export', [SuccessionStateController::class, 'export'])->name('reports.export');
});
