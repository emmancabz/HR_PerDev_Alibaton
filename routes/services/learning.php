<?php

use App\Http\Controllers\LearningStateController;
use Illuminate\Support\Facades\Route;

Route::middleware([
    'internal.service:learning',
    \Illuminate\Routing\Middleware\SubstituteBindings::class,
    'throttle:120,1',
])->prefix('learning/api')->name('learning.api.')->group(function (): void {
    Route::get('/state', [LearningStateController::class, 'show'])->name('state');
    Route::post('/courses', [LearningStateController::class, 'create'])->name('courses.create');
    Route::put('/versions/{version}', [LearningStateController::class, 'save'])->name('versions.save');
    Route::post('/versions/{version}/review', [LearningStateController::class, 'submitReview'])->name('versions.review');
    Route::post('/versions/{version}/review-decision', [LearningStateController::class, 'decideReview'])->name('versions.review-decision');
    Route::post('/versions/{version}/publish', [LearningStateController::class, 'publish'])->name('versions.publish');
    Route::post('/versions/{version}/source-review', [LearningStateController::class, 'sourceReview'])->middleware('throttle:10,1')->name('versions.source-review');
    Route::post('/versions/{version}/publication-retry', [LearningStateController::class, 'retryPublication'])->name('versions.publication-retry');
    Route::post('/versions/{version}/working-draft', [LearningStateController::class, 'workingDraft'])->name('versions.working-draft');
    Route::post('/courses/{course}/archive', [LearningStateController::class, 'archive'])->name('courses.archive');
    Route::post('/versions/{version}/assignment-preview', [LearningStateController::class, 'assignmentPreview'])->name('assignments.preview');
    Route::post('/versions/{version}/assign', [LearningStateController::class, 'assign'])->name('assignments.create');
    Route::post('/versions/{version}/self-enroll', [LearningStateController::class, 'selfEnroll'])->name('assignments.self-enroll');
    Route::post('/assignments/{assignment}/cancel', [LearningStateController::class, 'cancelAssignment'])->name('assignments.cancel');
    Route::post('/assignments/{assignment}/migrate', [LearningStateController::class, 'migrateAssignment'])->name('assignments.migrate');
    Route::get('/assignments/{assignment}/player', [LearningStateController::class, 'player'])->name('player');
    Route::put('/assignments/{assignment}/lesson-progress', [LearningStateController::class, 'lessonProgress'])->name('lesson-progress');
    Route::post('/assignments/{assignment}/assessments/{assessment}/attempts', [LearningStateController::class, 'startAttempt'])->name('attempts.start');
    Route::put('/attempts/{attempt}/responses', [LearningStateController::class, 'saveResponses'])->name('attempts.responses');
    Route::post('/attempts/{attempt}/submit', [LearningStateController::class, 'submitAttempt'])->name('attempts.submit');
    Route::post('/attempts/{attempt}/regrade', [LearningStateController::class, 'regradeAttempt'])->name('attempts.regrade');
    Route::post('/completions/{completion}/certificate', [LearningStateController::class, 'issueCertificate'])->name('certificates.issue');
    Route::post('/certificates/{certificate}/revoke', [LearningStateController::class, 'revokeCertificate'])->name('certificates.revoke');
    Route::get('/certificates/{certificate}/download', [LearningStateController::class, 'downloadCertificate'])->name('certificates.download');
    Route::post('/lessons/{lesson}/materials', [LearningStateController::class, 'uploadMaterial'])->middleware('throttle:20,1')->name('materials.upload');
    Route::delete('/materials/{material}', [LearningStateController::class, 'revokeMaterial'])->name('materials.revoke');
    Route::get('/materials/{material}/download', [LearningStateController::class, 'downloadMaterial'])->name('materials.download');
    Route::post('/versions/{version}/thumbnail', [LearningStateController::class, 'uploadThumbnail'])->middleware('throttle:20,1')->name('thumbnails.upload');
    Route::get('/versions/{version}/thumbnail', [LearningStateController::class, 'downloadThumbnail'])->name('thumbnails.download');
    Route::post('/versions/{version}/ai', [LearningStateController::class, 'aiGenerate'])->middleware('throttle:10,1')->name('ai.generate');
    Route::post('/ai/{event}/decision', [LearningStateController::class, 'aiDecide'])->name('ai.decide');
    Route::post('/recommendations', [LearningStateController::class, 'receiveRecommendation'])->name('recommendations.receive');
    Route::post('/recommendations/{learningRequest}/action', [LearningStateController::class, 'actRecommendation'])->name('recommendations.action');
});
