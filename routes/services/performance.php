<?php

use App\Http\Controllers\AnonymousPerformanceFeedbackController;
use App\Http\Controllers\Performance360FeedbackController;
use App\Http\Controllers\PerformanceIntelligenceController;
use App\Http\Controllers\PerformanceStateController;
use App\Http\Controllers\PerformanceUserReviewsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['internal.service:performance', 'throttle:120,1'])->group(function (): void {
    Route::prefix('performance/api')->name('performance.api.')->group(function (): void {
        Route::get('/state', [PerformanceStateController::class, 'show'])->name('state');
        Route::put('/reviews', [PerformanceStateController::class, 'reviews'])->name('reviews');
        Route::patch('/reviews/{review}/transition', [PerformanceStateController::class, 'transitionReview'])->name('reviews.transition');
        Route::patch('/reviews/{review}/calibration', [PerformanceStateController::class, 'calibration'])->name('reviews.calibration');
        Route::patch('/goals/{goal}/progress', [PerformanceStateController::class, 'goalProgress'])->name('goals.progress');
        Route::put('/development', [PerformanceStateController::class, 'development'])->name('development');
        Route::put('/pips', [PerformanceStateController::class, 'pip'])->name('pips.save');
        Route::patch('/pips/{pip}/governance', [PerformanceStateController::class, 'pipGovernance'])->name('pips.governance');
        Route::put('/configuration', [PerformanceStateController::class, 'configuration'])->name('configuration');
        Route::post('/anonymous-feedback', [AnonymousPerformanceFeedbackController::class, 'store'])->middleware('throttle:10,1')->name('anonymous-feedback.store');
        Route::get('/anonymous-feedback/{subject}/{cycle}', [AnonymousPerformanceFeedbackController::class, 'summary'])->name('anonymous-feedback.summary');
        Route::post('/intelligence/draft', PerformanceIntelligenceController::class)->middleware('throttle:10,1')->name('intelligence.draft');
    });

    Route::prefix('api/performance/360')->name('performance.api.360.')->group(function (): void {
        Route::get('/tasks', [Performance360FeedbackController::class, 'index'])->name('tasks');
        Route::post('/feedback', [Performance360FeedbackController::class, 'store'])->name('feedback.store');
    });

    Route::prefix('api/performance/user-reviews')->name('performance.api.user-reviews.')->group(function (): void {
        Route::get('/', [PerformanceUserReviewsController::class, 'index'])->name('index');
        Route::post('/', [PerformanceUserReviewsController::class, 'store'])->name('store');
    });
});
