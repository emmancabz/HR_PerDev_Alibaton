<?php

use App\Http\Controllers\CompetencyController;
use Illuminate\Support\Facades\Route;

Route::middleware(['internal.service:competency', 'throttle:180,1'])->group(function (): void {
    Route::get('/competency/api/state', [CompetencyController::class, 'show'])->name('competency.state');
    Route::post('/competency/api/changes', [CompetencyController::class, 'update'])->name('competency.changes');
});
