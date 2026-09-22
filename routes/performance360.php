<?php

use App\Http\Controllers\Performance360FeedbackController;
use App\Http\Controllers\PerformanceUserReviewsController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'throttle:120,1', 'mfa-status'])
    ->prefix('api/performance/360')
    ->name('performance.api.360.')
    ->group(function (): void {
        Route::get('/tasks', [Performance360FeedbackController::class, 'index'])->name('tasks');
        Route::post('/feedback', [Performance360FeedbackController::class, 'store'])->name('feedback.store');
    });

Route::middleware(['auth', 'throttle:120,1', 'mfa-status'])
    ->prefix('api/performance/user-reviews')
    ->name('performance.api.user-reviews.')
    ->group(function (): void {
        Route::get('/', [PerformanceUserReviewsController::class, 'index'])->name('index');
        Route::post('/', [PerformanceUserReviewsController::class, 'store'])->name('store');
    });
