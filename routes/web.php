<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
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
        Route::get('/learning', fn () => Inertia::render('ModulePage', ['title' => 'Learning Management']))->name('learning.index');
        Route::get('/training', fn () => Inertia::render('ModulePage', ['title' => 'Training Management']))->name('training.index');
        Route::get('/competency', fn () => Inertia::render('ModulePage', ['title' => 'Competency Management']))->name('competency.index');
        Route::get('/performance', fn () => Inertia::render('ModulePage', ['title' => 'Performance Management']))->name('performance.index');
        Route::get('/succession', fn () => Inertia::render('ModulePage', ['title' => 'Succession Planning']))->name('succession.index');
        Route::get('/recognition', fn () => Inertia::render('ModulePage', ['title' => 'Social Recognition']))->name('recognition.index');
        Route::get('/reports', fn () => Inertia::render('ModulePage', ['title' => 'Reports']))->name('reports.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::middleware('role:user')->prefix('user')->name('user.')->group(function () {
        Route::get('/learning', fn () => Inertia::render('ModulePage', ['title' => 'My Learning']))->name('learning.index');
        Route::get('/training', fn () => Inertia::render('ModulePage', ['title' => 'My Training']))->name('training.index');
        Route::get('/skills-wallet', fn () => Inertia::render('ModulePage', ['title' => 'My Skills Wallet']))->name('skills.index');
        Route::get('/performance', fn () => Inertia::render('ModulePage', ['title' => 'My Performance']))->name('performance.index');
        Route::get('/career-path', fn () => Inertia::render('ModulePage', ['title' => 'My Career Path']))->name('career.index');
        Route::get('/leaderboard', fn () => Inertia::render('ModulePage', ['title' => 'Company Leaderboard']))->name('leaderboard.index');
        Route::get('/transcripts', fn () => Inertia::render('ModulePage', ['title' => 'My Transcripts']))->name('transcripts.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', fn () => Inertia::render('UserManagement'))->name('users.index');
        Route::get('/audit-logs', fn () => Inertia::render('ModulePage', ['title' => 'System Audit Logs']))->name('audit.index');
        Route::get('/performance', fn () => Inertia::render('PerformanceManagement'))->name('performance.index');
        Route::get('/competency', fn () => Inertia::render('CompetencyManagement'))->name('competency.index');
        Route::get('/learning', fn () => Inertia::render('LearningManagement'))->name('learning.index');
        Route::get('/training', fn () => Inertia::render('ModulePage', ['title' => 'Training Management']))->name('training.index');
        Route::get('/succession', fn () => Inertia::render('ModulePage', ['title' => 'Succession Planning']))->name('succession.index');
        Route::get('/recognition', fn () => Inertia::render('ModulePage', ['title' => 'Social Recognition']))->name('recognition.index');
        Route::get('/reports', fn () => Inertia::render('ModulePage', ['title' => 'Reports']))->name('reports.index');
        Route::get('/integrations', fn () => Inertia::render('ModulePage', ['title' => 'Integration Settings']))->name('integrations.index');
        Route::get('/settings', fn () => Inertia::render('ModulePage', ['title' => 'Settings']))->name('settings.index');
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
