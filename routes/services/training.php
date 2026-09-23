<?php

use App\Http\Controllers\TrainingStateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['internal.service:training', 'throttle:120,1'])->prefix('training/api')->name('training.api.')->group(function (): void {
    Route::get('/state', [TrainingStateController::class, 'show'])->name('state');
    Route::post('/requirements/schedule', [TrainingStateController::class, 'scheduleRequirements'])->name('requirements.schedule');
    Route::post('/programs', [TrainingStateController::class, 'createProgram'])->name('programs.create');
    Route::put('/programs/{program}', [TrainingStateController::class, 'updateProgram'])->name('programs.update');
    Route::post('/programs/{program}/transition', [TrainingStateController::class, 'transitionProgram'])->name('programs.transition');
    Route::post('/programs/{program}/sessions', [TrainingStateController::class, 'createSession'])->name('sessions.create');
    Route::put('/programs/{program}/sessions/{session}', [TrainingStateController::class, 'updateSession'])->name('sessions.update');
    Route::post('/sessions/{session}/transition', [TrainingStateController::class, 'transitionSession'])->name('sessions.transition');
    Route::post('/programs/{program}/enrollments', [TrainingStateController::class, 'enroll'])->name('enrollments.create');
    Route::post('/enrollments/{enrollment}/transition', [TrainingStateController::class, 'transitionEnrollment'])->name('enrollments.transition');
    Route::post('/sessions/{session}/workforce-sync', [TrainingStateController::class, 'syncWorkforce'])->name('attendance.sync');
    Route::put('/attendance/{attendance}', [TrainingStateController::class, 'markAttendance'])->name('attendance.mark');
    Route::post('/sessions/{session}/attendance/finalize', [TrainingStateController::class, 'finalizeAttendance'])->name('attendance.finalize');
    Route::put('/enrollments/{enrollment}/assessment', [TrainingStateController::class, 'assess'])->name('assessments.save');
    Route::post('/enrollments/{enrollment}/completion', [TrainingStateController::class, 'finalizeCompletion'])->name('completions.finalize');
    Route::post('/sessions/{session}/completion/finalize-ready', [TrainingStateController::class, 'finalizeReadyParticipants'])->name('completions.finalize-ready');
    Route::post('/certificates/{certificate}/revoke', [TrainingStateController::class, 'revokeCertificate'])->name('certificates.revoke');
    Route::put('/sessions/{session}/feedback', [TrainingStateController::class, 'feedback'])->name('feedback.save');
    Route::post('/recommendations', [TrainingStateController::class, 'receiveRecommendation'])->name('recommendations.receive');
    Route::post('/recommendations/{recommendation}/action', [TrainingStateController::class, 'actRecommendation'])->name('recommendations.action');
    Route::get('/reports/export', [TrainingStateController::class, 'export'])->name('reports.export');
    Route::get('/certificates/{certificate}', [TrainingStateController::class, 'certificate'])->name('certificates.download');
});
