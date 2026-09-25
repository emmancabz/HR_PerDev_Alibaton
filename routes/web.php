<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\CompetencyController;
use App\Http\Controllers\GlobalSearchController;
use App\Http\Controllers\HeaderNotificationController;
use App\Http\Controllers\HeaderNotificationReadController;
use App\Http\Controllers\AnonymousPerformanceFeedbackController;
use App\Http\Controllers\PerformanceIntelligenceController;
use App\Http\Controllers\PerformancePageController;
use App\Http\Controllers\PerformanceStateController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\LearningPageController;
use App\Http\Controllers\LearningStateController;
use App\Http\Controllers\Microservices\MicroserviceProxyController;
use App\Http\Controllers\Microservices\MicroservicesHealthController;
use App\Http\Controllers\TrainingPageController;
use App\Http\Controllers\TrainingStateController;
use App\Http\Controllers\UserManagementPageController;
use App\Http\Controllers\UserManagementStateController;
use App\Http\Controllers\SuccessionPageController;
use App\Http\Controllers\SuccessionStateController;
use App\Http\Controllers\RecognitionPageController;
use App\Http\Controllers\RecognitionStateController;
use App\Http\Controllers\ReportsPageController;
use App\Http\Controllers\ReportsStateController;
use App\Http\Controllers\SettingsPageController;
use App\Http\Controllers\SettingsStateController;
use App\Services\Personnel\CanonicalPersonnelService;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return auth()->check()
        ? redirect()->route('dashboard')
        : redirect()->route('login');
})->name('home');

Route::middleware('auth')->group(function () {
    Route::get('/competency', [CompetencyController::class, 'page'])->name('competency.index');

    if (config('microservices.enabled')) {
        Route::any('/competency/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'competency')
            ->middleware('throttle:180,1')
            ->name('competency.proxy');
    } else {
        Route::get('/competency/api/state', [CompetencyController::class, 'show'])->name('competency.state');
        Route::post('/competency/api/changes', [CompetencyController::class, 'update'])->middleware('throttle:180,1')->name('competency.changes');
    }
    Route::get('/dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('/api/global-search', GlobalSearchController::class)
        ->middleware('throttle:90,1')
        ->name('global-search');
    Route::get('/api/header-notifications', HeaderNotificationController::class)
        ->middleware('throttle:90,1')
        ->name('header-notifications');
    Route::post('/api/header-notifications/read', HeaderNotificationReadController::class)
        ->middleware('throttle:120,1')
        ->name('header-notifications.read');

    Route::get('/admin/dashboard', [DashboardController::class, 'admin'])
        ->middleware('role:admin')
        ->name('admin.dashboard');
    Route::get('/admin/api/microservices/health', MicroservicesHealthController::class)
        ->middleware(['role:admin', 'throttle:30,1'])
        ->name('admin.microservices.health');

    Route::get('/hr/dashboard', [DashboardController::class, 'hr'])
        ->middleware('role:hr')
        ->name('hr.dashboard');

    Route::get('/user/dashboard', [DashboardController::class, 'user'])
        ->middleware('role:user')
        ->name('user.dashboard');

    Route::middleware('role:hr')->prefix('hr')->name('hr.')->group(function () {
        Route::get('/users', [UserManagementPageController::class, 'index'])->name('users.index');
        Route::get('/performance', [PerformancePageController::class, 'administration'])->name('performance.index');
        Route::get('/performance/manage-evaluators', [PerformancePageController::class, 'evaluatorAdministration'])->name('performance.evaluators');
        Route::get('/competency', [CompetencyController::class, 'page'])->name('competency.index');
        Route::get('/learning', [LearningPageController::class, 'administration'])->name('learning.index');
        Route::get('/training', [TrainingPageController::class, 'administration'])->name('training.index');
        Route::get('/succession', [SuccessionPageController::class, 'administration'])->name('succession.index');
        Route::get('/recognition', [RecognitionPageController::class, 'administration'])->name('recognition.index');
        Route::get('/reports', [ReportsPageController::class, 'index'])->name('reports.index');
        Route::get('/settings', [SettingsPageController::class, 'index'])->name('settings.index');
    });

    Route::middleware('role:user')->prefix('user')->name('user.')->group(function () {
        Route::get('/learning', [LearningPageController::class, 'learner'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('learning.index');
        Route::get('/assessments', [LearningPageController::class, 'learner'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('assessments.index');
        Route::get('/certificates', [LearningPageController::class, 'learner'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('certificates.index');
        Route::get('/training', [TrainingPageController::class, 'learner'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('training.index');
        Route::get('/development', [CompetencyController::class, 'wallet'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('development.index');
        Route::get('/skills-wallet', [CompetencyController::class, 'wallet'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('skills.index');
        Route::get('/profile', fn () => Inertia::render('UserProfile'))
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('profile.index');
        Route::get('/notifications', fn () => Inertia::render('UserNotifications'))
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('notifications.index');
        Route::get('/performance', [PerformancePageController::class, 'user'])
            ->middleware('persona:employee,supervisor,manager')
            ->name('performance.index');
        Route::get('/leaderboard', [RecognitionPageController::class, 'user'])
            ->middleware('persona:employee,supervisor,manager')
            ->name('leaderboard.index');
        Route::get('/transcripts', fn () => redirect(route('user.learning.index').'#Learning%20History'))
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('transcripts.index');
        Route::get('/settings', [SettingsPageController::class, 'index'])
            ->middleware('persona:trainee,employee,supervisor,manager')
            ->name('settings.index');
    });

    // User-governance mutation endpoints remain under /admin, but authorization is enforced
    // inside the controller so JSON callers receive a true 403 instead of a role-redirect 302.
    Route::prefix('admin')->name('admin.')->group(function () {
        Route::patch('/users/{user}/access', [UserManagementStateController::class, 'updateAccess'])->name('users.access.update');
        Route::patch('/users/{user}/role', [UserManagementStateController::class, 'updateRole'])->name('users.role.update');
        Route::post('/users/{user}/access-link', [UserManagementStateController::class, 'sendAccessLink'])->middleware('throttle:12,1')->name('users.access-link.send');
    });

    Route::middleware('role:admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/users', [UserManagementPageController::class, 'index'])->name('users.index');
        Route::get('/audit-logs', [SettingsPageController::class, 'index'])->name('audit.index');
        Route::get('/performance', [PerformancePageController::class, 'administration'])->name('performance.index');
        Route::get('/performance/manage-evaluators', [PerformancePageController::class, 'evaluatorAdministration'])->name('performance.evaluators');
Route::get('/competency', [CompetencyController::class, 'page'])->name('competency.index');
Route::get('/learning', [LearningPageController::class, 'administration'])->name('learning.index');
Route::get('/training', [TrainingPageController::class, 'administration'])->name('training.index');
Route::get('/succession', [SuccessionPageController::class, 'administration'])->name('succession.index');
Route::get('/recognition', [RecognitionPageController::class, 'administration'])->name('recognition.index');
        Route::get('/reports', [ReportsPageController::class, 'index'])->name('reports.index');
        Route::get('/integrations', [SettingsPageController::class, 'index'])->name('integrations.index');
        Route::get('/settings', [SettingsPageController::class, 'index'])->name('settings.index');
    });

    Route::prefix('governance/api')->name('governance.api.')->middleware('throttle:90,1,mfa-status')->group(function () {
        Route::get('/reports', [ReportsStateController::class, 'show'])->name('reports.state');
        Route::get('/reports/{report}/{format}', [ReportsStateController::class, 'export'])->name('reports.export');
        Route::get('/settings', [SettingsStateController::class, 'show'])->name('settings.state');
        Route::post('/settings/unlock', [SettingsStateController::class, 'unlock'])->middleware('throttle:12,1')->name('settings.unlock');
        Route::put('/settings', [SettingsStateController::class, 'update'])->name('settings.update');
        Route::patch('/settings/profile', [SettingsStateController::class, 'updateProfile'])->middleware('throttle:20,1')->name('settings.profile');
        Route::put('/settings/notifications', [SettingsStateController::class, 'updateNotifications'])->middleware('throttle:30,1')->name('settings.notifications');
        Route::post('/settings/profile-photo', [SettingsStateController::class, 'profilePhoto'])->middleware('throttle:10,1')->name('settings.profile-photo');
        Route::delete('/settings/profile-photo', [SettingsStateController::class, 'removeProfilePhoto'])->middleware('throttle:10,1')->name('settings.profile-photo.remove');
        Route::post('/settings/accounts/{user}/archive', [SettingsStateController::class, 'archive'])->name('settings.accounts.archive');
        Route::post('/settings/accounts/{user}/restore', [SettingsStateController::class, 'restore'])->name('settings.accounts.restore');
        Route::delete('/settings/accounts/{user}/identity', [SettingsStateController::class, 'deleteIdentity'])->name('settings.accounts.delete-identity');
    });

    if (config('microservices.enabled')) {
        Route::any('/performance/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'performance')
            ->middleware('throttle:120,1,mfa-status')
            ->name('performance.proxy');

        Route::any('/api/performance/360/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'performance')
            ->middleware('throttle:120,1,mfa-status')
            ->name('performance.360.proxy');

        Route::any('/api/performance/user-reviews/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'performance')
            ->middleware('throttle:120,1,mfa-status')
            ->name('performance.user-reviews.proxy');
    } else {
    Route::prefix('performance/api')->name('performance.api.')->middleware('throttle:120,1,mfa-status')->group(function () {
        Route::get('/state', [PerformanceStateController::class, 'show'])->name('state');
        Route::put('/reviews', [PerformanceStateController::class, 'reviews'])->name('reviews');
        Route::patch('/reviews/{review}/transition', [PerformanceStateController::class, 'transitionReview'])->name('reviews.transition');
        Route::patch('/reviews/{review}/calibration', [PerformanceStateController::class, 'calibration'])->name('reviews.calibration');
        Route::patch('/goals/{goal}/progress', [PerformanceStateController::class, 'goalProgress'])->name('goals.progress');
        Route::put('/development', [PerformanceStateController::class, 'development'])->name('development');
        Route::put('/pips', [PerformanceStateController::class, 'pip'])->name('pips.save');
        Route::patch('/pips/{pip}/governance', [PerformanceStateController::class, 'pipGovernance'])->name('pips.governance');
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
    }

    if (config('microservices.enabled')) {
        Route::get('/learning/api/certificates/{certificate}/download', MicroserviceProxyController::class)
            ->defaults('service', 'learning')
            ->middleware(['signed', 'throttle:120,1,mfa-status'])
            ->name('learning.api.certificates.download');
        Route::get('/learning/api/materials/{material}/download', MicroserviceProxyController::class)
            ->defaults('service', 'learning')
            ->middleware(['signed', 'throttle:120,1,mfa-status'])
            ->name('learning.api.materials.download');
        Route::get('/learning/api/versions/{version}/thumbnail', MicroserviceProxyController::class)
            ->defaults('service', 'learning')
            ->middleware(['signed', 'throttle:120,1,mfa-status'])
            ->name('learning.api.thumbnails.download');
        Route::any('/learning/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'learning')
            ->middleware('throttle:120,1,mfa-status')
            ->name('learning.proxy');
    } else {
    Route::prefix('learning/api')->name('learning.api.')->middleware('throttle:120,1,mfa-status')->group(function () {
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
    }

    if (config('microservices.enabled')) {
        Route::any('/training/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'training')
            ->middleware('throttle:120,1,mfa-status')
            ->name('training.proxy');
    } else {
    Route::prefix('training/api')->name('training.api.')->middleware('throttle:120,1,mfa-status')->group(function () {
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
    }

    if (config('microservices.enabled')) {
        Route::any('/succession/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'succession')
            ->middleware('throttle:120,1,mfa-status')
            ->name('succession.proxy');
    } else {
    Route::prefix('succession/api')->name('succession.api.')->middleware('throttle:120,1,mfa-status')->group(function () {
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
    }

    if (config('microservices.enabled')) {
        Route::any('/recognition/api/{path?}', MicroserviceProxyController::class)
            ->where('path', '.*')
            ->defaults('service', 'recognition')
            ->middleware('throttle:120,1,mfa-status')
            ->name('recognition.proxy');
    } else {
    Route::prefix('recognition/api')->name('recognition.api.')->middleware('throttle:120,1,mfa-status')->group(function () {
        Route::get('/state', [RecognitionStateController::class, 'show'])->name('state');
        Route::post('/records', [RecognitionStateController::class, 'create'])->middleware('throttle:20,1')->name('records.create');
        Route::put('/records/{record}', [RecognitionStateController::class, 'update'])->name('records.update');
        Route::post('/records/{record}/submit', [RecognitionStateController::class, 'submit'])->name('records.submit');
        Route::post('/records/{record}/decision', [RecognitionStateController::class, 'decision'])->name('records.decision');
        Route::post('/records/{record}/revoke', [RecognitionStateController::class, 'revoke'])->name('records.revoke');
        Route::post('/categories', [RecognitionStateController::class, 'createCategory'])->name('categories.create');
        Route::put('/categories/{category}', [RecognitionStateController::class, 'updateCategory'])->name('categories.update');
    });
    }

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

Route::post('/aevyn/chat', [\App\Http\Controllers\AI\AevynController::class, 'chat'])
    ->middleware('auth')
    ->name('aevyn.chat');

if (! config('microservices.enabled')) {
    require __DIR__.'/performance360.php';
}

require __DIR__.'/auth.php';
