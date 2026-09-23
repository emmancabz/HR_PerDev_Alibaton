<?php

use App\Http\Controllers\RecognitionStateController;
use Illuminate\Support\Facades\Route;

Route::middleware(['internal.service:recognition', 'throttle:120,1'])->prefix('recognition/api')->name('recognition.api.')->group(function (): void {
    Route::get('/state', [RecognitionStateController::class, 'show'])->name('state');
    Route::post('/records', [RecognitionStateController::class, 'create'])->middleware('throttle:20,1')->name('records.create');
    Route::put('/records/{record}', [RecognitionStateController::class, 'update'])->name('records.update');
    Route::post('/records/{record}/submit', [RecognitionStateController::class, 'submit'])->name('records.submit');
    Route::post('/records/{record}/decision', [RecognitionStateController::class, 'decision'])->name('records.decision');
    Route::post('/records/{record}/revoke', [RecognitionStateController::class, 'revoke'])->name('records.revoke');
    Route::post('/categories', [RecognitionStateController::class, 'createCategory'])->name('categories.create');
    Route::put('/categories/{category}', [RecognitionStateController::class, 'updateCategory'])->name('categories.update');
});
