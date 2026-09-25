<?php

namespace App\Http\Controllers;

use App\Support\SchemaPresence;
use Illuminate\Support\Facades\Route;

use App\Models\User;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GlobalSearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['required', 'string', 'min:2', 'max:80'],
        ]);

        /** @var User $actor */
        $actor = $request->user();
        $term = trim($validated['q']);
        $pattern = '%'.mb_strtolower($term).'%';
        $role = $actor->role->value;
        $operator = in_array($role, ['admin', 'hr'], true);

        $results = collect();

        $results->push(...$this->systemPageResults($term, $role));
        $results->push(...$this->tableNameResults($term, $role));
        $results->push(...$this->peopleResults($actor, $pattern, $role));
        $results->push(...$this->competencyResults($actor, $pattern, $role, $operator));
        $results->push(...$this->learningResults($actor, $pattern, $role, $operator));
        $results->push(...$this->performanceResults($actor, $pattern, $role, $operator));

        if ($operator) {
            $results->push(...$this->trainingResults($pattern, $role));
            $results->push(...$this->successionResults($pattern, $role));
            $results->push(...$this->recognitionResults($pattern, $role));
        }

        return response()->json([
            'data' => $results
                ->filter()
                ->unique('key')
                ->take(60)
                ->values()
                ->all(),
        ]);
    }


    /** @return array<int, array<string, string>> */
    private function systemPageResults(string $term, string $role): array
    {
        $needle = mb_strtolower(trim($term));
        if ($needle === '') {
            return [];
        }

        $items = [];
        $add = function (string $key, string $group, string $label, string $module, string $description, string $href) use (&$items, $needle): void {
            $haystack = mb_strtolower(implode(' ', [$group, $label, $module, $description]));
            if (str_contains($haystack, $needle)) {
                $items[] = $this->result($key, $group, $label, $module, $description, $href);
            }
        };

        $dashboardRoute = match ($role) {
            'admin' => 'admin.dashboard',
            'hr' => 'hr.dashboard',
            default => 'user.dashboard',
        };
        $reportsRoute = match ($role) {
            'admin' => 'admin.reports.index',
            'hr' => 'hr.reports.index',
            default => null,
        };
        $settingsRoute = match ($role) {
            'admin' => 'admin.settings.index',
            'hr' => 'hr.settings.index',
            default => 'user.settings.index',
        };

        $add('page:dashboard', 'Navigation', 'Dashboard', 'Dashboard', 'Workforce overview, activity, training, performance, and people summary', route($dashboardRoute));

        if (in_array($role, ['admin', 'hr'], true)) {
            $usersRoute = $role === 'admin' ? 'admin.users.index' : 'hr.users.index';
            if (Route::has($usersRoute)) {
                $add('page:users', 'Navigation', 'Users', 'People & Personnel', 'Personnel directory, incoming trainees, account issues, access and role governance', $this->workspaceHref($usersRoute, 'All Users'));
            }
        }

        if ($reportsRoute !== null) {
            foreach ([
                'workforce-development' => ['Workforce Development Summary', 'Cross-module workforce development, competency, learning, training, performance and recognition'],
                'performance-cycle' => ['Performance Cycle Status', 'Performance reviews, cycle status, final ratings and completion'],
                'learning-compliance' => ['Learning Completion & Certificate Status', 'Learning assignments, completions, assessments and certificates'],
                'training-effectiveness' => ['Training Attendance & Completion', 'Training attendance, practical results, completion and certificates'],
                'succession-risk' => ['Succession Coverage & Risk', 'Critical positions, successor coverage, readiness and succession risk'],
                'recognition-activity' => ['Recognition Activity', 'Social recognition nominations, recipients, categories and status'],
            ] as $reportKey => [$label, $description]) {
                $add('report:'.$reportKey, 'Reports', $label, 'Reports', $description, route($reportsRoute, ['report' => $reportKey]));
            }
        }

        $settingsSections = [
            'profile' => ['My Profile', 'Settings', 'Profile photo, full name, email and account identity'],
            'security' => ['Account & Security', 'Settings', 'Password, MFA, passkeys, trusted devices, sessions and access controls'],
            'notifications' => ['Notifications & Alerts', 'Settings', 'Header notification preferences and workflow alerts'],
        ];
        if ($role === 'admin') {
            $settingsSections += [
                'security-activity' => ['Security Activity', 'Settings', 'Sign-ins, failed attempts, session activity and security events'],
                'organization' => ['Organization & Reporting', 'Settings', 'Organization-wide display, reporting and governance defaults'],
                'archive' => ['Archive & Retention', 'Settings', 'Archived accounts, retention periods and identity deletion governance'],
            ];
        } elseif ($role === 'hr') {
            $settingsSections += [
                'organization' => ['Organization & Reporting', 'Settings', 'Organization-wide display and reporting defaults'],
            ];
        }
        $settingsSections += [
            'faq' => ['FAQ', 'Help & Legal', 'Frequently asked questions and application guidance'],
            'privacy' => ['Privacy Policy', 'Help & Legal', 'How workforce, account, security and historical data are handled'],
            'terms' => ['Terms of Service', 'Help & Legal', 'Authorized use, account responsibilities, monitoring and administrative controls'],
            'license' => ['Open-source Licenses', 'Help & Legal', 'Software license and open-source attribution information'],
        ];

        foreach ($settingsSections as $section => [$label, $module, $description]) {
            $href = match (true) {
                $role === 'user' && $section === 'profile' => route('user.profile.index').'#Employee%20Info',
                $role === 'user' && $section === 'notifications' => route('user.profile.index').'#Notifications',
                default => route($settingsRoute, ['section' => $section]),
            };
            $add('settings:'.$section, 'Settings', $label, $module, $description, $href);
        }

        return array_slice($items, 0, 18);
    }

    /** @return array<int, array<string, string>> */
    private function competencyResults(User $actor, string $pattern, string $role, bool $operator): array
    {
        $results = collect();
        $competencyRoute = match ($role) {
            'admin' => 'admin.competency.index',
            'hr' => 'hr.competency.index',
            default => 'user.skills.index',
        };

        if ($operator && SchemaPresence::hasTable('competency_definitions')) {
            $definitions = DB::table('competency_definitions')
                ->where(function (Builder $builder) use ($pattern): void {
                    $builder->whereRaw("LOWER(COALESCE(id, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(COALESCE(status, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(CAST(payload AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('updated_at')
                ->limit(7)
                ->get(['id', 'status', 'payload']);

            foreach ($definitions as $definition) {
                $payload = $this->jsonPayload($definition->payload);
                $name = (string) ($payload['name'] ?? $payload['title'] ?? $definition->id);
                $code = (string) ($payload['code'] ?? '');
                $results->push($this->result(
                    key: 'competency-definition:'.$definition->id,
                    group: 'Competency',
                    label: trim($code !== '' ? $code.' — '.$name : $name),
                    module: 'Competency Framework',
                    description: collect([$payload['category'] ?? null, $definition->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($competencyRoute, 'Competency Framework'),
                ));
            }
        }

        if ($operator && SchemaPresence::hasTable('competency_role_profiles')) {
            $profiles = DB::table('competency_role_profiles')
                ->where(function (Builder $builder) use ($pattern): void {
                    $builder->whereRaw("LOWER(COALESCE(id, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(COALESCE(status, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(CAST(payload AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('updated_at')
                ->limit(5)
                ->get(['id', 'status', 'payload']);

            foreach ($profiles as $profile) {
                $payload = $this->jsonPayload($profile->payload);
                $label = (string) ($payload['name'] ?? $payload['position'] ?? $payload['title'] ?? 'Role Profile');
                $results->push($this->result(
                    key: 'competency-role-profile:'.$profile->id,
                    group: 'Competency',
                    label: $label,
                    module: 'Competency Framework',
                    description: collect([$payload['department'] ?? null, $payload['position'] ?? null, $profile->status])->filter()->unique()->implode(' · '),
                    href: $this->workspaceHref($competencyRoute, 'Competency Framework'),
                ));
            }
        }

        if ($operator && SchemaPresence::hasTable('competency_cycles')) {
            $cycles = DB::table('competency_cycles')
                ->where(function (Builder $builder) use ($pattern): void {
                    $builder->whereRaw("LOWER(COALESCE(id, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(COALESCE(status, '')) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(CAST(payload AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('updated_at')
                ->limit(5)
                ->get(['id', 'status', 'payload']);

            foreach ($cycles as $cycle) {
                $payload = $this->jsonPayload($cycle->payload);
                $results->push($this->result(
                    key: 'competency-cycle:'.$cycle->id,
                    group: 'Competency',
                    label: (string) ($payload['name'] ?? $payload['title'] ?? 'Assessment Cycle'),
                    module: 'Assessments',
                    description: collect([$payload['type'] ?? $payload['cycleType'] ?? null, $cycle->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($competencyRoute, 'Assessments'),
                ));
            }
        }

        if (SchemaPresence::hasTable('competency_assessments') && SchemaPresence::hasTable('users')) {
            $assessments = DB::table('competency_assessments as assessments')
                ->join('users as people', 'people.id', '=', 'assessments.person_id')
                ->join('users as assessors', 'assessors.id', '=', 'assessments.assessor_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('assessments.person_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['assessments.id', 'assessments.status', 'people.name', 'people.position', 'people.department', 'assessors.name'], $pattern);
                    $builder->orWhereRaw("LOWER(CAST(assessments.payload AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('assessments.updated_at')
                ->limit(7)
                ->get(['assessments.id', 'assessments.status', 'assessments.payload', 'people.name as person_name', 'assessors.name as assessor_name']);

            foreach ($assessments as $assessment) {
                $payload = $this->jsonPayload($assessment->payload);
                $results->push($this->result(
                    key: 'competency-assessment:'.$assessment->id,
                    group: 'Competency',
                    label: (string) $assessment->person_name,
                    module: $operator ? 'Assessments' : 'My Skills Wallet',
                    description: collect([$payload['assessmentType'] ?? null, $assessment->status, $operator ? 'Assessor: '.$assessment->assessor_name : null])->filter()->implode(' · '),
                    href: $operator ? $this->workspaceHref($competencyRoute, 'Assessments') : route($competencyRoute),
                ));
            }
        }

        if (SchemaPresence::hasTable('competency_recommendations') && SchemaPresence::hasTable('users')) {
            $recommendations = DB::table('competency_recommendations as recommendations')
                ->join('users as people', 'people.id', '=', 'recommendations.person_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('recommendations.person_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['recommendations.id', 'recommendations.status', 'recommendations.competency_id', 'people.name'], $pattern);
                    $builder->orWhereRaw("LOWER(CAST(recommendations.payload AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('recommendations.updated_at')
                ->limit(6)
                ->get(['recommendations.id', 'recommendations.status', 'recommendations.payload', 'people.name as person_name']);

            foreach ($recommendations as $recommendation) {
                $payload = $this->jsonPayload($recommendation->payload);
                $title = (string) ($payload['title'] ?? $payload['recommendationTitle'] ?? $payload['name'] ?? 'Development Recommendation');
                $results->push($this->result(
                    key: 'competency-recommendation:'.$recommendation->id,
                    group: 'Competency',
                    label: $title,
                    module: $operator ? 'Development' : 'My Skills Wallet',
                    description: collect([$recommendation->person_name, $recommendation->status])->filter()->implode(' · '),
                    href: $operator ? $this->workspaceHref($competencyRoute, 'Development') : route($competencyRoute),
                ));
            }
        }

        return $results->all();
    }

    /** @return array<int, array<string, string>> */
    private function peopleResults(User $actor, string $pattern, string $role): array
    {
        if (! SchemaPresence::hasTable('users')) {
            return [];
        }

        $query = DB::table('users')
            ->when($role === 'user', fn (Builder $builder) => $builder->where('id', $actor->id))
            ->when($role === 'hr', fn (Builder $builder) => $builder
                ->whereNotNull('personnel_key')
                ->whereRaw("TRIM(personnel_key) <> ''"))
            ->where(function (Builder $builder) use ($pattern): void {
                $this->whereLikeAny($builder, [
                    'name',
                    'email',
                    'employee_or_trainee_id',
                    'position',
                    'department',
                    'person_type',
                ], $pattern);
            })
            ->orderBy('name')
            ->limit(7)
            ->get([
                'id',
                'personnel_key',
                'name',
                'email',
                'employee_or_trainee_id',
                'position',
                'department',
                'person_type',
            ]);

        return $query->map(function (object $user) use ($role): array {
            $description = collect([
                $user->employee_or_trainee_id,
                $user->position,
                $user->department,
                $user->person_type,
            ])->filter()->implode(' · ');

            $href = match ($role) {
                'admin' => $this->workspaceHref('admin.users.index', 'All Users'),
                'hr' => $this->workspaceHref('hr.users.index', 'All Users'),
                default => route('user.profile.index').'#Employee%20Info',
            };

            return $this->result(
                key: 'person:'.($user->personnel_key ?: $user->id),
                group: 'People',
                label: (string) $user->name,
                module: 'People & Personnel',
                description: $description !== '' ? $description : (string) $user->email,
                href: $href,
            );
        })->all();
    }

    /** @return array<int, array<string, string>> */
    private function learningResults(User $actor, string $pattern, string $role, bool $operator): array
    {
        $results = collect();
        $learningRoute = $role === 'admin'
            ? 'admin.learning.index'
            : ($role === 'hr' ? 'hr.learning.index' : 'user.learning.index');

        if (SchemaPresence::hasTable('learning_courses') && SchemaPresence::hasTable('learning_course_versions') && ($operator || SchemaPresence::hasTable('learning_assignments'))) {
            $courses = DB::table('learning_course_versions as versions')
                ->join('learning_courses as courses', 'courses.id', '=', 'versions.course_id')
                ->when(! $operator, function (Builder $builder) use ($actor): void {
                    $builder->whereExists(function (Builder $subquery) use ($actor): void {
                        $subquery->selectRaw('1')
                            ->from('learning_assignments as visible_assignments')
                            ->whereColumn('visible_assignments.course_version_id', 'versions.id')
                            ->where('visible_assignments.learner_id', $actor->id)
                            ->where('visible_assignments.status', '!=', 'Cancelled');
                    });
                })
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'courses.code',
                        'versions.title',
                        'versions.description',
                        'versions.category',
                        'versions.difficulty',
                    ], $pattern);
                })
                ->orderByDesc('versions.updated_at')
                ->limit(7)
                ->get([
                    'courses.id as course_id',
                    'courses.code',
                    'versions.id as version_id',
                    'versions.title',
                    'versions.category',
                    'versions.status',
                ]);

            foreach ($courses as $course) {
                $results->push($this->result(
                    key: 'learning-course:'.$course->version_id,
                    group: 'Learning',
                    label: (string) $course->title,
                    module: 'Courses',
                    description: collect([$course->code, $course->category, $course->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($learningRoute, $operator ? 'Courses' : null),
                ));
            }
        }

        if ($operator && SchemaPresence::hasTable('learning_requests')) {
            $requests = DB::table('learning_requests')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'recommendation_title',
                        'recommendation_note',
                        'competency_name',
                        'recommended_by_name',
                        'status',
                    ], $pattern);
                })
                ->orderByDesc('created_at')
                ->limit(5)
                ->get(['id', 'recommendation_title', 'competency_name', 'recommended_by_name', 'status']);

            foreach ($requests as $request) {
                $results->push($this->result(
                    key: 'learning-request:'.$request->id,
                    group: 'Learning',
                    label: (string) $request->recommendation_title,
                    module: 'Overview',
                    description: collect([$request->competency_name, $request->status, $request->recommended_by_name])->filter()->implode(' · '),
                    href: $this->workspaceHref($learningRoute, 'Overview'),
                ));
            }
        }

        if (SchemaPresence::hasTable('learning_certificates') && SchemaPresence::hasTable('learning_completions') && SchemaPresence::hasTable('learning_course_versions') && SchemaPresence::hasTable('users')) {
            $certificates = DB::table('learning_certificates as certificates')
                ->join('learning_completions as completions', 'completions.id', '=', 'certificates.completion_id')
                ->join('users as learners', 'learners.id', '=', 'completions.learner_id')
                ->join('learning_course_versions as versions', 'versions.id', '=', 'completions.course_version_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('completions.learner_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'certificates.certificate_number',
                        'certificates.status',
                        'learners.name',
                        'versions.title',
                    ], $pattern);
                })
                ->orderByDesc('certificates.created_at')
                ->limit(5)
                ->get([
                    'certificates.id',
                    'certificates.certificate_number',
                    'certificates.status',
                    'learners.name as learner_name',
                    'versions.title as course_title',
                ]);

            foreach ($certificates as $certificate) {
                $results->push($this->result(
                    key: 'learning-certificate:'.$certificate->id,
                    group: 'Learning',
                    label: (string) $certificate->certificate_number,
                    module: 'Learning Records',
                    description: collect([$certificate->course_title, $certificate->learner_name, $certificate->status])->filter()->implode(' · '),
                    href: $role === 'user'
                        ? route('user.transcripts.index')
                        : $this->workspaceHref($learningRoute, 'Learning Records'),
                ));
            }
        }

        if ($operator && SchemaPresence::hasTable('learning_course_modules') && SchemaPresence::hasTable('learning_course_versions')) {
            $content = DB::table('learning_course_modules as modules')
                ->join('learning_course_versions as versions', 'versions.id', '=', 'modules.course_version_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['modules.title', 'modules.description'], $pattern);
                })
                ->orderBy('modules.display_order')
                ->limit(4)
                ->get(['modules.id', 'modules.title', 'versions.title as course_title']);

            foreach ($content as $module) {
                $results->push($this->result(
                    key: 'learning-module:'.$module->id,
                    group: 'Learning',
                    label: (string) $module->title,
                    module: 'Course Content',
                    description: (string) $module->course_title,
                    href: $this->workspaceHref($learningRoute, 'Courses'),
                ));
            }
        }

        if (SchemaPresence::hasTable('learning_assignments') && SchemaPresence::hasTable('learning_course_versions') && SchemaPresence::hasTable('users')) {
            $assignments = DB::table('learning_assignments as assignments')
                ->join('learning_course_versions as versions', 'versions.id', '=', 'assignments.course_version_id')
                ->join('users as learners', 'learners.id', '=', 'assignments.learner_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('assignments.learner_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'versions.title',
                        'assignments.status',
                        'assignments.source',
                        'learners.name',
                        'learners.department',
                        'learners.position',
                    ], $pattern);
                })
                ->orderByDesc('assignments.updated_at')
                ->limit(6)
                ->get(['assignments.id', 'assignments.status', 'assignments.source', 'versions.title as course_title', 'learners.name as learner_name']);

            foreach ($assignments as $assignment) {
                $results->push($this->result(
                    key: 'learning-assignment:'.$assignment->id,
                    group: 'Learning',
                    label: (string) $assignment->course_title,
                    module: $operator ? 'Assignments' : 'My Learning',
                    description: collect([$assignment->learner_name, $assignment->status, $assignment->source])->filter()->implode(' · '),
                    href: $operator ? $this->workspaceHref($learningRoute, 'Assignments') : route($learningRoute),
                ));
            }
        }

        return $results->all();
    }

    /** @return array<int, array<string, string>> */
    private function performanceResults(User $actor, string $pattern, string $role, bool $operator): array
    {
        $results = collect();
        $performanceRoute = $role === 'admin'
            ? 'admin.performance.index'
            : ($role === 'hr' ? 'hr.performance.index' : 'user.performance.index');

        if (SchemaPresence::hasTable('performance_cycles') && ($operator || (SchemaPresence::hasTable('performance_goals') && SchemaPresence::hasTable('performance_review_assignments')))) {
            $cycles = DB::table('performance_cycles')
                ->when(! $operator && SchemaPresence::hasTable('performance_goals') && SchemaPresence::hasTable('performance_review_assignments'), function (Builder $builder) use ($actor): void {
                    $builder->where(function (Builder $visible) use ($actor): void {
                        $visible->whereExists(function (Builder $subquery) use ($actor): void {
                            $subquery->selectRaw('1')
                                ->from('performance_goals as visible_goals')
                                ->whereColumn('visible_goals.performance_cycle_id', 'performance_cycles.id')
                                ->where('visible_goals.user_id', $actor->id);
                        })->orWhereExists(function (Builder $subquery) use ($actor): void {
                            $subquery->selectRaw('1')
                                ->from('performance_review_assignments as visible_reviews')
                                ->whereColumn('visible_reviews.performance_cycle_id', 'performance_cycles.id')
                                ->where(function (Builder $scope) use ($actor): void {
                                    $scope->where('visible_reviews.subject_user_id', $actor->id)
                                        ->orWhere('visible_reviews.evaluator_user_id', $actor->id);
                                });
                        });
                    });
                })
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['name', 'cycle_type', 'status', 'description'], $pattern);
                })
                ->orderByDesc('performance_start_date')
                ->limit(6)
                ->get(['id', 'name', 'cycle_type', 'status']);

            foreach ($cycles as $cycle) {
                $results->push($this->result(
                    key: 'performance-cycle:'.$cycle->id,
                    group: 'Performance',
                    label: (string) $cycle->name,
                    module: 'Review Governance',
                    description: collect([$cycle->cycle_type, $cycle->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($performanceRoute, $operator ? 'Review Governance' : null),
                ));
            }
        }

        if (SchemaPresence::hasTable('performance_goals') && SchemaPresence::hasTable('users') && SchemaPresence::hasTable('performance_cycles')) {
            $goals = DB::table('performance_goals as goals')
                ->join('users as people', 'people.id', '=', 'goals.user_id')
                ->leftJoin('performance_cycles as cycles', 'cycles.id', '=', 'goals.performance_cycle_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('goals.user_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'goals.title',
                        'goals.target',
                        'goals.status',
                        'people.name',
                        'cycles.name',
                    ], $pattern);
                })
                ->orderByDesc('goals.updated_at')
                ->limit(6)
                ->get([
                    'goals.id',
                    'goals.external_key as goal_key',
                    'goals.title',
                    'goals.status',
                    'people.name as person_name',
                    'people.personnel_key as person_key',
                    'cycles.name as cycle_name',
                    'cycles.external_key as cycle_key',
                ]);

            foreach ($goals as $goal) {
                $results->push($this->result(
                    key: 'performance-goal:'.$goal->goal_key,
                    group: 'Performance',
                    label: (string) $goal->title,
                    module: 'Reviews',
                    description: collect([$goal->person_name, $goal->cycle_name, $goal->status])->filter()->implode(' · '),
                    href: $this->appendSearchParams(
                        $this->workspaceHref($performanceRoute, $operator ? 'Reviews' : null),
                        [
                            'performance_cycle' => (string) $goal->cycle_key,
                            'gs_person' => (string) $goal->person_key,
                        ],
                    ),
                ));
            }
        }

        if (SchemaPresence::hasTable('performance_reviews') && SchemaPresence::hasTable('performance_review_assignments') && SchemaPresence::hasTable('users') && SchemaPresence::hasTable('performance_cycles')) {
            $reviews = DB::table('performance_reviews as reviews')
                ->join('performance_review_assignments as assignments', 'assignments.id', '=', 'reviews.performance_review_assignment_id')
                ->join('users as subjects', 'subjects.id', '=', 'assignments.subject_user_id')
                ->join('users as evaluators', 'evaluators.id', '=', 'assignments.evaluator_user_id')
                ->leftJoin('performance_cycles as cycles', 'cycles.id', '=', 'assignments.performance_cycle_id')
                ->when(! $operator, function (Builder $builder) use ($actor): void {
                    $builder->where(function (Builder $scope) use ($actor): void {
                        $scope->where('assignments.subject_user_id', $actor->id)
                            ->orWhere('assignments.evaluator_user_id', $actor->id);
                    });
                })
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'subjects.name',
                        'evaluators.name',
                        'cycles.name',
                        'reviews.status',
                        'reviews.workflow_state',
                        'reviews.calibration_status',
                    ], $pattern);
                })
                ->orderByDesc('reviews.updated_at')
                ->limit(6)
                ->get([
                    'reviews.id',
                    'reviews.external_key as review_key',
                    'reviews.status',
                    'reviews.workflow_state',
                    'subjects.name as subject_name',
                    'subjects.personnel_key as subject_key',
                    'evaluators.name as evaluator_name',
                    'cycles.name as cycle_name',
                    'cycles.external_key as cycle_key',
                ]);

            foreach ($reviews as $review) {
                $results->push($this->result(
                    key: 'performance-review:'.$review->review_key,
                    group: 'Performance',
                    label: (string) $review->subject_name,
                    module: 'Reviews',
                    description: collect([$review->cycle_name, $review->status, 'Evaluator: '.$review->evaluator_name])->filter()->implode(' · '),
                    href: $this->appendSearchParams(
                        $this->workspaceHref(
                            $performanceRoute,
                            $operator ? 'Reviews' : null,
                        ),
                        [
                            'performance_cycle' => (string) $review->cycle_key,
                            'gs_person' => (string) $review->subject_key,
                        ],
                    ),
                ));
            }
        }

        if (SchemaPresence::hasTable('performance_improvement_plans') && SchemaPresence::hasTable('users')) {
            $pips = DB::table('performance_improvement_plans as pips')
                ->join('users as subjects', 'subjects.id', '=', 'pips.subject_user_id')
                ->when(! $operator, fn (Builder $builder) => $builder->where('pips.subject_user_id', $actor->id))
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['subjects.name', 'pips.status'], $pattern);
                })
                ->orderByDesc('pips.updated_at')
                ->limit(4)
                ->get(['pips.id', 'pips.status', 'subjects.name as subject_name', 'pips.target_end_date']);

            foreach ($pips as $pip) {
                $results->push($this->result(
                    key: 'performance-pip:'.$pip->id,
                    group: 'Performance',
                    label: 'Performance Improvement Plan — '.$pip->subject_name,
                    module: 'Improvement Plans',
                    description: collect([$pip->status, $pip->target_end_date ? 'Target '.$pip->target_end_date : null])->filter()->implode(' · '),
                    href: $this->workspaceHref($performanceRoute, $operator ? 'Performance Improvement' : null),
                ));
            }
        }

        return $results->all();
    }

    /** @return array<int, array<string, string>> */
    private function trainingResults(string $pattern, string $role): array
    {
        $results = collect();
        $trainingRoute = $role === 'admin' ? 'admin.training.index' : 'hr.training.index';

        if (SchemaPresence::hasTable('training_programs')) {
            $programs = DB::table('training_programs')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'code',
                        'title',
                        'description',
                        'category',
                        'delivery_type',
                        'status',
                    ], $pattern);
                })
                ->orderByDesc('updated_at')
                ->limit(5)
                ->get(['id', 'code', 'title', 'category', 'delivery_type', 'status']);

            foreach ($programs as $program) {
                $results->push($this->result(
                    key: 'training-program:'.$program->id,
                    group: 'Training',
                    label: (string) $program->title,
                    module: 'Training Register',
                    description: collect([$program->code, $program->category, $program->delivery_type, $program->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($trainingRoute, 'Training Register'),
                ));
            }
        }

        if (SchemaPresence::hasTable('training_sessions') && SchemaPresence::hasTable('training_programs')) {
            $sessions = DB::table('training_sessions as sessions')
                ->join('training_programs as programs', 'programs.id', '=', 'sessions.program_id')
                ->leftJoin('users as facilitators', 'facilitators.id', '=', 'sessions.facilitator_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'sessions.label',
                        'sessions.venue',
                        'sessions.status',
                        'sessions.external_facilitator_name',
                        'programs.title',
                        'programs.code',
                        'facilitators.name',
                    ], $pattern);
                })
                ->orderByDesc('sessions.starts_at')
                ->limit(5)
                ->get([
                    'sessions.id',
                    'sessions.label',
                    'sessions.venue',
                    'sessions.status',
                    'sessions.starts_at',
                    'sessions.external_facilitator_name',
                    'programs.title as program_title',
                    'facilitators.name as facilitator_name',
                ]);

            foreach ($sessions as $session) {
                $facilitator = $session->facilitator_name ?: $session->external_facilitator_name;
                $results->push($this->result(
                    key: 'training-session:'.$session->id,
                    group: 'Training',
                    label: (string) $session->label,
                    module: 'Training Register',
                    description: collect([$session->program_title, $session->venue, $facilitator, $session->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($trainingRoute, 'Training Register'),
                ));
            }
        }

        if (
            SchemaPresence::hasTable('training_certificates') &&
            SchemaPresence::hasTable('training_completions') &&
            SchemaPresence::hasTable('training_enrollments') &&
            SchemaPresence::hasTable('training_programs') &&
            SchemaPresence::hasTable('users')
        ) {
            $records = DB::table('training_certificates as certificates')
                ->join('training_completions as completions', 'completions.id', '=', 'certificates.completion_id')
                ->join('training_enrollments as enrollments', 'enrollments.id', '=', 'completions.enrollment_id')
                ->join('training_programs as programs', 'programs.id', '=', 'enrollments.program_id')
                ->join('users as participants', 'participants.id', '=', 'enrollments.participant_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'certificates.certificate_number',
                        'certificates.status',
                        'completions.status',
                        'programs.title',
                        'programs.code',
                        'participants.name',
                    ], $pattern);
                })
                ->orderByDesc('certificates.issued_at')
                ->limit(4)
                ->get([
                    'certificates.id',
                    'certificates.certificate_number',
                    'certificates.status as certificate_status',
                    'completions.status as completion_status',
                    'programs.title as program_title',
                    'participants.name as participant_name',
                ]);

            foreach ($records as $record) {
                $results->push($this->result(
                    key: 'training-record:'.$record->id,
                    group: 'Training',
                    label: (string) $record->participant_name,
                    module: 'Training Records',
                    description: collect([$record->program_title, $record->certificate_number, $record->completion_status, $record->certificate_status])->filter()->implode(' · '),
                    href: $this->workspaceHref($trainingRoute, 'Training Records'),
                ));
            }
        }

        if (SchemaPresence::hasTable('training_recommendations')) {
            $requirements = DB::table('training_recommendations as recommendations')
                ->leftJoin('users as people', 'people.personnel_key', '=', 'recommendations.personnel_key')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'recommendations.development_need',
                        'recommendations.reason',
                        'recommendations.source_module',
                        'recommendations.status',
                        'recommendations.personnel_key',
                        'people.name',
                        'people.position',
                        'people.department',
                    ], $pattern);
                    $builder->orWhereRaw("LOWER(CAST(recommendations.source_snapshot AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('recommendations.updated_at')
                ->limit(6)
                ->get(['recommendations.id', 'recommendations.development_need', 'recommendations.source_module', 'recommendations.status', 'people.name as person_name']);

            foreach ($requirements as $requirement) {
                $results->push($this->result(
                    key: 'training-requirement:'.$requirement->id,
                    group: 'Training',
                    label: (string) $requirement->development_need,
                    module: 'Overview',
                    description: collect([$requirement->person_name, $requirement->source_module, $requirement->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($trainingRoute, 'Overview'),
                ));
            }
        }

        return $results->all();
    }

    /** @return array<int, array<string, string>> */
    private function successionResults(string $pattern, string $role): array
    {
        $results = collect();
        $successionRoute = $role === 'admin' ? 'admin.succession.index' : 'hr.succession.index';

        if (SchemaPresence::hasTable('succession_critical_positions')) {
            $positions = DB::table('succession_critical_positions as positions')
                ->leftJoin('users as incumbents', 'incumbents.id', '=', 'positions.incumbent_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'positions.position_title',
                        'positions.department',
                        'positions.criticality',
                        'positions.status',
                        'positions.business_impact',
                        'positions.vacancy_risk',
                        'incumbents.name',
                    ], $pattern);
                })
                ->orderByDesc('positions.updated_at')
                ->limit(6)
                ->get([
                    'positions.id',
                    'positions.position_title',
                    'positions.department',
                    'positions.criticality',
                    'positions.status',
                    'incumbents.name as incumbent_name',
                ]);

            foreach ($positions as $position) {
                $results->push($this->result(
                    key: 'succession-position:'.$position->id,
                    group: 'Succession',
                    label: (string) $position->position_title,
                    module: 'Succession Register',
                    description: collect([$position->department, $position->criticality, $position->incumbent_name, $position->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($successionRoute, 'Succession Register'),
                ));
            }
        }

        if (SchemaPresence::hasTable('succession_candidates') && SchemaPresence::hasTable('succession_critical_positions') && SchemaPresence::hasTable('users')) {
            $candidates = DB::table('succession_candidates as candidates')
                ->join('succession_critical_positions as positions', 'positions.id', '=', 'candidates.critical_position_id')
                ->join('users as people', 'people.id', '=', 'candidates.candidate_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'people.name',
                        'people.position',
                        'people.department',
                        'positions.position_title',
                        'candidates.status',
                        'candidates.nomination_source',
                        'candidates.nomination_rationale',
                    ], $pattern);
                })
                ->orderByDesc('candidates.updated_at')
                ->limit(6)
                ->get([
                    'candidates.id',
                    'candidates.status',
                    'candidates.nomination_source',
                    'positions.position_title',
                    'people.name as candidate_name',
                    'people.position as current_position',
                ]);

            foreach ($candidates as $candidate) {
                $results->push($this->result(
                    key: 'succession-candidate:'.$candidate->id,
                    group: 'Succession',
                    label: (string) $candidate->candidate_name,
                    module: 'Readiness Reviews',
                    description: collect([$candidate->position_title, $candidate->current_position, $candidate->status, $candidate->nomination_source])->filter()->implode(' · '),
                    href: $this->workspaceHref($successionRoute, 'Readiness Reviews'),
                ));
            }
        }

        if (SchemaPresence::hasTable('succession_development_plans') && SchemaPresence::hasTable('succession_candidates') && SchemaPresence::hasTable('succession_critical_positions') && SchemaPresence::hasTable('users')) {
            $plans = DB::table('succession_development_plans as plans')
                ->join('succession_candidates as candidates', 'candidates.id', '=', 'plans.succession_candidate_id')
                ->join('succession_critical_positions as positions', 'positions.id', '=', 'candidates.critical_position_id')
                ->join('users as people', 'people.id', '=', 'candidates.candidate_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'plans.title',
                        'plans.objective',
                        'plans.status',
                        'people.name',
                        'positions.position_title',
                    ], $pattern);
                })
                ->orderByDesc('plans.updated_at')
                ->limit(4)
                ->get([
                    'plans.id',
                    'plans.title',
                    'plans.status',
                    'plans.target_date',
                    'people.name as candidate_name',
                    'positions.position_title',
                ]);

            foreach ($plans as $plan) {
                $results->push($this->result(
                    key: 'succession-plan:'.$plan->id,
                    group: 'Succession',
                    label: (string) $plan->title,
                    module: 'Readiness Reviews',
                    description: collect([$plan->candidate_name, $plan->position_title, $plan->status, $plan->target_date ? 'Target '.$plan->target_date : null])->filter()->implode(' · '),
                    href: $this->workspaceHref($successionRoute, 'Readiness Reviews'),
                ));
            }
        }

        if (SchemaPresence::hasTable('succession_readiness_assessments') && SchemaPresence::hasTable('succession_candidates') && SchemaPresence::hasTable('succession_critical_positions') && SchemaPresence::hasTable('users')) {
            $reviews = DB::table('succession_readiness_assessments as assessments')
                ->join('succession_candidates as candidates', 'candidates.id', '=', 'assessments.succession_candidate_id')
                ->join('succession_critical_positions as positions', 'positions.id', '=', 'candidates.critical_position_id')
                ->join('users as people', 'people.id', '=', 'candidates.candidate_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'people.name',
                        'people.position',
                        'people.department',
                        'positions.position_title',
                        'assessments.status',
                        'assessments.readiness_band',
                        'assessments.reviewer_summary',
                    ], $pattern);
                    $builder->orWhereRaw("LOWER(CAST(assessments.development_needs AS TEXT)) LIKE ?", [$pattern])
                        ->orWhereRaw("LOWER(CAST(assessments.risk_flags AS TEXT)) LIKE ?", [$pattern]);
                })
                ->orderByDesc('assessments.updated_at')
                ->limit(6)
                ->get(['assessments.id', 'assessments.status', 'assessments.readiness_band', 'people.name as candidate_name', 'positions.position_title']);

            foreach ($reviews as $review) {
                $results->push($this->result(
                    key: 'succession-readiness:'.$review->id,
                    group: 'Succession',
                    label: (string) $review->candidate_name,
                    module: 'Readiness Reviews',
                    description: collect([$review->position_title, $review->readiness_band ?: 'Not Assessed', $review->status])->filter()->implode(' · '),
                    href: $this->workspaceHref($successionRoute, 'Readiness Reviews'),
                ));
            }
        }

        return $results->all();
    }

    /** @return array<int, array<string, string>> */
    private function recognitionResults(string $pattern, string $role): array
    {
        $results = collect();
        $recognitionRoute = $role === 'admin' ? 'admin.recognition.index' : 'hr.recognition.index';

        if (SchemaPresence::hasTable('recognition_records') && SchemaPresence::hasTable('recognition_categories')) {
            $records = DB::table('recognition_records as records')
                ->join('recognition_categories as categories', 'categories.id', '=', 'records.category_id')
                ->leftJoin('users as recipients', 'recipients.id', '=', 'records.recipient_id')
                ->leftJoin('users as nominators', 'nominators.id', '=', 'records.nominator_id')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, [
                        'records.title',
                        'records.achievement_details',
                        'records.status',
                        'categories.name',
                        'categories.code',
                        'recipients.name',
                        'recipients.position',
                        'recipients.department',
                        'nominators.name',
                    ], $pattern);
                })
                ->orderByDesc('records.updated_at')
                ->limit(7)
                ->get([
                    'records.id',
                    'records.title',
                    'records.status',
                    'records.achievement_date',
                    'categories.name as category_name',
                    'recipients.name as recipient_name',
                    'nominators.name as nominator_name',
                ]);

            foreach ($records as $record) {
                $workspace = $record->status === 'Pending Review' ? 'Review Queue' : 'Recognition Register';
                $results->push($this->result(
                    key: 'recognition-record:'.$record->id,
                    group: 'Recognition',
                    label: (string) ($record->recipient_name ?: $record->title),
                    module: $workspace,
                    description: collect([$record->title, $record->category_name, $record->status, $record->nominator_name ? 'By '.$record->nominator_name : null])->filter()->implode(' · '),
                    href: $this->workspaceHref($recognitionRoute, $workspace),
                ));
            }
        }

        if (SchemaPresence::hasTable('recognition_categories')) {
            $categories = DB::table('recognition_categories')
                ->where(function (Builder $builder) use ($pattern): void {
                    $this->whereLikeAny($builder, ['code', 'name', 'description'], $pattern);
                })
                ->orderBy('display_order')
                ->limit(5)
                ->get(['id', 'code', 'name', 'description', 'is_active']);

            foreach ($categories as $category) {
                $results->push($this->result(
                    key: 'recognition-category:'.$category->id,
                    group: 'Recognition',
                    label: (string) $category->name,
                    module: 'Recognition Categories',
                    description: collect([$category->code, $category->is_active ? 'Active' : 'Inactive'])->filter()->implode(' · '),
                    href: $this->workspaceHref($recognitionRoute, 'Overview'),
                ));
            }
        }

        return $results->all();
    }


    /** @return array<string, mixed> */
    private function jsonPayload(mixed $payload): array
    {
        if (is_array($payload)) {
            return $payload;
        }

        if (! is_string($payload) || trim($payload) === '') {
            return [];
        }

        $decoded = json_decode($payload, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function whereLikeAny(Builder $query, array $columns, string $pattern): void
    {
        foreach ($columns as $index => $column) {
            $method = $index === 0 ? 'whereRaw' : 'orWhereRaw';
            $query->{$method}("LOWER(COALESCE({$column}, '')) LIKE ?", [$pattern]);
        }
    }

    /**
     * Search business table/workspace names.
     *
     * @return array<int, array<string, string>>
     */
    private function tableNameResults(string $term, string $role): array
    {
        if (! in_array($role, ['admin', 'hr'], true)) {
            return [];
        }

        $needle = mb_strtolower(trim($term));

        if ($needle === '') {
            return [];
        }

        $routes = [
            'people' => $role === 'admin'
                ? 'admin.users.index'
                : 'hr.users.index',

            'performance' => $role === 'admin'
                ? 'admin.performance.index'
                : 'hr.performance.index',

            'competency' => $role === 'admin'
                ? 'admin.competency.index'
                : 'hr.competency.index',

            'learning' => $role === 'admin'
                ? 'admin.learning.index'
                : 'hr.learning.index',

            'training' => $role === 'admin'
                ? 'admin.training.index'
                : 'hr.training.index',

            'succession' => $role === 'admin'
                ? 'admin.succession.index'
                : 'hr.succession.index',

            'recognition' => $role === 'admin'
                ? 'admin.recognition.index'
                : 'hr.recognition.index',
        ];

        $tables = [
            [
                'All Users',
                'People & Personnel',
                'people',
                'All Users',
                'users personnel people workforce directory employees trainees accounts',
            ],
            [
                'Incoming Trainees',
                'People & Personnel',
                'people',
                'Incoming Trainees',
                'incoming trainees onboarding personnel',
            ],
            [
                'Account Issues',
                'People & Personnel',
                'people',
                'Account Issues',
                'account issues access activation locked suspended personnel',
            ],
            [
                'Reviews',
                'Performance',
                'performance',
                'Reviews',
                'reviews review formal evaluation performance review',
            ],
            [
                'Goals & KPIs',
                'Performance',
                'performance',
                'Overview',
                'goal goals kpi kpis performance goals',
            ],
            [
                'Review Governance',
                'Performance',
                'performance',
                'Review Governance',
                'review governance evaluator evaluators authority',
            ],
            [
                'Performance Improvement',
                'Performance',
                'performance',
                'Performance Improvement',
                'performance improvement pip improvement plans',
            ],

            [
                'Competency Framework',
                'Competency',
                'competency',
                'Competency Framework',
                'competency framework competencies profiles',
            ],
            [
                'Competency Assessments',
                'Competency',
                'competency',
                'Assessments',
                'competency assessment assessments',
            ],

            [
                'Courses',
                'Learning',
                'learning',
                'Courses',
                'course courses learning catalog',
            ],
            [
                'Learning Assignments',
                'Learning',
                'learning',
                'Assignments',
                'learning assignment assignments',
            ],
            [
                'Learning Records',
                'Learning',
                'learning',
                'Learning Records',
                'learning records transcript completion certificates',
            ],

            [
                'Training Register',
                'Training',
                'training',
                'Training Register',
                'training register sessions schedule',
            ],
            [
                'Attendance',
                'Training',
                'training',
                'Training Records',
                'attendance training attendance records',
            ],
            [
                'Training Records',
                'Training',
                'training',
                'Training Records',
                'training records completions certificates',
            ],

            [
                'Succession Register',
                'Succession',
                'succession',
                'Succession Register',
                'succession register candidates critical positions',
            ],
            [
                'Readiness Reviews',
                'Succession',
                'succession',
                'Readiness Reviews',
                'readiness reviews succession readiness',
            ],

            [
                'Recognition Register',
                'Recognition',
                'recognition',
                'Recognition Register',
                'recognition register awards records',
            ],
            [
                'Recognition Review Queue',
                'Recognition',
                'recognition',
                'Review Queue',
                'recognition review queue decisions',
            ],
        ];

        $results = [];

        foreach ($tables as [$label, $module, $family, $workspace, $aliases]) {
            $haystack = mb_strtolower(
                $label.' '.$module.' '.$aliases
            );

            if (! str_contains($haystack, $needle)) {
                continue;
            }

            $routeName = $routes[$family] ?? null;

            if (! $routeName || ! Route::has($routeName)) {
                continue;
            }

            $results[] = [
                'key' => 'table:'.sha1(
                    $family.'|'.$workspace.'|'.$label
                ),
                'group' => 'Tables',
                'label' => $label,
                'module' => $module,
                'description' => 'Open '.$label.' table',
                'href' => $this->appendSearchParams(
                    $this->workspaceHref(
                        $routeName,
                        $workspace,
                    ),
                    [
                        'gs_table' => $label === 'Attendance'
                            ? 'Training Records'
                            : $label,
                    ],
                ),
            ];
        }

        return $results;
    }

    /**
     * Append query parameters while preserving workspace hash.
     *
     * @param array<string, scalar|null> $params
     */
    private function appendSearchParams(
        string $href,
        array $params,
    ): string {
        [$base, $fragment] = array_pad(
            explode('#', $href, 2),
            2,
            null,
        );

        $params = array_filter(
            $params,
            static fn ($value) =>
                $value !== null
                && $value !== '',
        );

        if ($params !== []) {
            $base .= (
                str_contains($base, '?')
                    ? '&'
                    : '?'
            ).http_build_query($params);
        }

        if (
            is_string($fragment)
            && $fragment !== ''
        ) {
            return $base.'#'.$fragment;
        }

        return $base;
    }

    /** @return array<string, string> */
    private function result(
        string $key,
        string $group,
        string $label,
        string $module,
        string $description,
        string $href,
    ): array {
        if (in_array($group, [
            'People',
            'Competency',
            'Learning',
            'Performance',
            'Training',
            'Succession',
            'Recognition',
        ], true)) {
            $record = str_contains($key, ':')
                ? substr(
                    $key,
                    strpos($key, ':') + 1,
                )
                : $key;

            $targetTable = match (true) {
                $group === 'People' => 'All Users',
                str_starts_with($key, 'performance-review:') => 'Reviews',
                str_starts_with($key, 'performance-goal:') => 'Reviews',
                default => $module,
            };

            $href = $this->appendSearchParams(
                $href,
                [
                    'gs_table' => $targetTable,
                    'gs_record' => $record,
                    'gs_match' => $label,
                    'gs_context' => $description,
                    'gs_open' => '1',
                ],
            );
        }

        return compact(
            'key',
            'group',
            'label',
            'module',
            'description',
            'href',
        );
    }

    private function workspaceHref(string $routeName, ?string $workspace): string
    {
        $href = route($routeName);

        if (! $workspace) {
            return $href;
        }

        return $href.'#'.rawurlencode($workspace);
    }
}
