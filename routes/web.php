<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\AnonymousPerformanceFeedbackController;
use App\Http\Controllers\PerformanceIntelligenceController;
use App\Http\Controllers\PerformancePageController;
use App\Http\Controllers\PerformanceStateController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\LearningPageController;
use App\Http\Controllers\LearningStateController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware('auth')->group(function () {
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');

    Route::get('/admin/dashboard', [DashboardController::class, 'admin'])
        ->middleware('role:admin')
        ->name('admin.dashboard');

    Route::get('/hr/dashboard', [DashboardController::class, 'hr'])
        ->middleware('role:hr')
        ->name('hr.dashboard');

    Route::get('/user/dashboard', [DashboardController::class, 'user'])
        ->middleware('role:user')
        ->name('user.dashboard');

    Route::middleware('role:hr')->prefix('hr')->name('hr.')->group(function () {
        Route::get('/learning', [LearningPageController::class, 'administration'])->name('learning.index');
        Route::get('/training', fn () => Inertia::render('TrainingManagement'))->name('training.index');
        Route::get('/competency', fn () => Inertia::render('ModulePage', ['title' => 'Competency Management']))->name('competency.index');
        Route::get('/performance', [PerformancePageController::class, 'administration'])->name('performance.index');
        Route::get('/succession', fn () => Inertia::render('ModulePage', ['title' => 'Succession Planning']))->name('succession.index');
        Route::get('/recognition', fn () => Inertia::render('ModulePage', ['title' => 'Social Recognition']))->name('recognition.index');
        Route::get('/reports', fn () => Inertia::render('ModulePage', ['title' => 'Reports']))->name('reports.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::middleware('role:user')->prefix('user')->name('user.')->group(function () {
        Route::get('/learning', [LearningPageController::class, 'learner'])->name('learning.index');
        Route::get('/training', fn () => Inertia::render('ModulePage', ['title' => 'My Training']))->name('training.index');
        Route::get('/skills-wallet', fn () => Inertia::render('ModulePage', ['title' => 'My Skills Wallet']))->name('skills.index');
        Route::get('/performance', [PerformancePageController::class, 'user'])->name('performance.index');
        Route::get('/career-path', fn () => Inertia::render('ModulePage', ['title' => 'My Career Path']))->name('career.index');
        Route::get('/leaderboard', fn () => Inertia::render('ModulePage', ['title' => 'Company Leaderboard']))->name('leaderboard.index');
        Route::get('/transcripts', fn () => Inertia::render('ModulePage', ['title' => 'My Transcripts']))->name('transcripts.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', fn () => Inertia::render('UserManagement'))->name('users.index');
        Route::get('/audit-logs', fn () => Inertia::render('ModulePage', ['title' => 'System Audit Logs']))->name('audit.index');
        Route::get('/performance', [PerformancePageController::class, 'administration'])->name('performance.index');
Route::get('/competency', fn () => Inertia::render('AdminCompetency'))->name('competency.index');
Route::get('/learning', [LearningPageController::class, 'administration'])->name('learning.index');
Route::get('/training', fn () => Inertia::render('AdminTraining'))->name('training.index');
Route::get('/succession', fn () => Inertia::render('AdminSuccession'))->name('succession.index');
Route::get('/recognition', fn () => Inertia::render('AdminRecognition'))->name('recognition.index');
        Route::get('/reports', fn () => Inertia::render('ModulePage', ['title' => 'Reports']))->name('reports.index');
        Route::get('/integrations', fn () => Inertia::render('ModulePage', ['title' => 'Integration Settings']))->name('integrations.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::prefix('performance/api')->name('performance.api.')->middleware('throttle:120,1')->group(function () {
        Route::get('/state', [PerformanceStateController::class, 'show'])->name('state');
        Route::put('/reviews', [PerformanceStateController::class, 'reviews'])->name('reviews');
        Route::put('/development', [PerformanceStateController::class, 'development'])->name('development');
        Route::put('/configuration', [PerformanceStateController::class, 'configuration'])->name('configuration');
        Route::post('/anonymous-feedback', [AnonymousPerformanceFeedbackController::class, 'store'])
            ->middleware('throttle:10,1')
            ->name('anonymous-feedback.store');
        Route::get('/anonymous-feedback/{subject}/{cycle}', [AnonymousPerformanceFeedbackController::class, 'summary'])
            ->name('anonymous-feedback.summary');
        Route::post('/intelligence/draft', PerformanceIntelligenceController::class)
            ->middleware('throttle:10,1')
            ->name('intelligence.draft');
    });

    Route::prefix('learning/api')->name('learning.api.')->middleware('throttle:120,1')->group(function () {
        Route::get('/state', [LearningStateController::class, 'show'])->name('state');
        Route::post('/courses', [LearningStateController::class, 'create'])->name('courses.create');
        Route::put('/versions/{version}', [LearningStateController::class, 'save'])->name('versions.save');
        Route::post('/versions/{version}/review', [LearningStateController::class, 'submitReview'])->name('versions.review');
        Route::post('/versions/{version}/review-decision', [LearningStateController::class, 'decideReview'])->name('versions.review-decision');
        Route::post('/versions/{version}/publish', [LearningStateController::class, 'publish'])->name('versions.publish');
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
        Route::post('/certificates/{certificate}/revoke', [LearningStateController::class, 'revokeCertificate'])->name('certificates.revoke');
        Route::get('/certificates/{certificate}/download', [LearningStateController::class, 'downloadCertificate'])->middleware('signed')->name('certificates.download');
        Route::post('/lessons/{lesson}/materials', [LearningStateController::class, 'uploadMaterial'])->middleware('throttle:20,1')->name('materials.upload');
        Route::delete('/materials/{material}', [LearningStateController::class, 'revokeMaterial'])->name('materials.revoke');
        Route::get('/materials/{material}/download', [LearningStateController::class, 'downloadMaterial'])->middleware('signed')->name('materials.download');
        Route::post('/versions/{version}/thumbnail', [LearningStateController::class, 'uploadThumbnail'])->middleware('throttle:20,1')->name('thumbnails.upload');
        Route::get('/versions/{version}/thumbnail', [LearningStateController::class, 'downloadThumbnail'])->middleware('signed')->name('thumbnails.download');
        Route::post('/versions/{version}/ai', [LearningStateController::class, 'aiGenerate'])->middleware('throttle:10,1')->name('ai.generate');
        Route::post('/ai/{event}/decision', [LearningStateController::class, 'aiDecide'])->name('ai.decide');
        Route::post('/recommendations', [LearningStateController::class, 'receiveRecommendation'])->name('recommendations.receive');
        Route::post('/recommendations/{learningRequest}/action', [LearningStateController::class, 'actRecommendation'])->name('recommendations.action');
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
