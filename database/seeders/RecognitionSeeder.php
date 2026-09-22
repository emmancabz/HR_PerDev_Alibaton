<?php

namespace Database\Seeders;

use App\Enums\UserRole;
use App\Models\Recognition\RecognitionCategory;
use App\Models\Recognition\RecognitionRecord;
use App\Models\User;
use App\Services\Recognition\RecognitionService;
use Illuminate\Database\Seeder;
use RuntimeException;

class RecognitionSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment(['local', 'testing']) || ! config('recognition.operational_seed_enabled')) {
            throw new RuntimeException('Recognition seed data is restricted to local/testing and requires RECOGNITION_OPERATIONAL_SEED_ENABLED=true.');
        }

        $operator = User::query()
            ->whereIn('role', [UserRole::Admin->value, UserRole::HR->value])
            ->orderBy('id')
            ->firstOrFail();

        $people = User::query()->activePersonnel()->get()->keyBy('personnel_key');
        $requiredPeople = ['user-8', 'user-10', 'user-gen-0', 'user-gen-1', 'user-gen-2', 'user-gen-22'];
        foreach ($requiredPeople as $personnelKey) {
            if (! $people->has($personnelKey)) {
                throw new RuntimeException("Recognition operational seeding requires canonical personnel {$personnelKey}.");
            }
        }

        $categories = RecognitionCategory::query()->get()->keyBy('code');
        foreach (['SAFETY_COMPLIANCE', 'TEAMWORK_COLLABORATION', 'LEADERSHIP', 'PERFORMANCE_EXCELLENCE', 'LEARNING_DEVELOPMENT', 'INNOVATION'] as $code) {
            if (! $categories->has($code)) {
                throw new RuntimeException("Recognition category {$code} is unavailable. Run migrations first.");
            }
        }

        $service = app(RecognitionService::class);
        $samples = [
            ['user-8', 'SAFETY_COMPLIANCE', 'Safety Leadership Contribution', 'Demonstrated consistent hazard-control coordination and supported documented safety follow-through across assigned work.', 'Recognized', 14, 'Verified safety coordination and escalation follow-through.'],
            ['user-gen-0', 'PERFORMANCE_EXCELLENCE', 'Reliable Crane Operations Execution', 'Delivered assigned crane operations work with disciplined handovers, safety checks, and clear coordination with the operating team.', 'Recognized', 24, 'Operational handover and work-quality note.'],
            ['user-gen-1', 'TEAMWORK_COLLABORATION', 'Dispatch Coordination Support', 'Helped keep dispatch, delivery, and road-safety coordination aligned across responsible teams during a time-sensitive work period.', 'Recognized', 33, 'Cross-team coordination note from the operating period.'],
            ['user-gen-2', 'LEADERSHIP', 'Operations Team Support', 'Supported colleagues through clear work coordination, follow-through, and practical knowledge sharing during an operational assignment.', 'Recognized', 48, 'Supervisor-observed coordination and knowledge-sharing note.'],
            ['user-gen-22', 'PERFORMANCE_EXCELLENCE', 'Records Control Excellence', 'Maintained accurate records and document-control follow-through while helping the team resolve documentation exceptions through the approved process.', 'Recognized', 62, 'Records-management and document-control contribution note.'],
            ['user-10', 'LEARNING_DEVELOPMENT', 'Knowledge Sharing Contribution', 'Prepared clear learning support and helped colleagues apply documented procedures during workforce development activities.', 'Recognized', 76, 'Learning-support and knowledge-transfer note.'],
            ['user-8', 'LEADERSHIP', 'Peer Safety Coaching', 'Provided practical peer coaching and reinforced safe work practices during routine safety coordination.', 'Pending Review', 4, 'Pending governance review of the documented coaching contribution.'],
            ['user-gen-1', 'INNOVATION', 'Dispatch Workflow Improvement', 'Proposed a practical workflow improvement that reduced avoidable coordination gaps in dispatch preparation.', 'Pending Review', 2, 'Pending review of the documented process-improvement contribution.'],
        ];

        foreach ($samples as [$personnelKey, $categoryCode, $title, $details, $status, $daysAgo, $note]) {
            /** @var User $recipient */
            $recipient = $people->get($personnelKey);
            /** @var RecognitionCategory $category */
            $category = $categories->get($categoryCode);
            $achievementAt = now()->subDays($daysAgo)->startOfDay()->addHours(9);
            $record = RecognitionRecord::query()
                ->where('title', $title)
                ->where('recipient_personnel_key', $recipient->personnel_key)
                ->first();

            if (! $record) {
                $record = $service->create($operator, [
                    'recipientId' => $recipient->id,
                    'categoryId' => $category->id,
                    'title' => $title,
                    'achievementDetails' => $details,
                    'achievementDate' => $achievementAt->toDateString(),
                    'saveAsDraft' => false,
                    'evidence' => [[
                        'type' => 'Supporting Note',
                        'description' => $note,
                    ]],
                ]);
            }

            if ($status === 'Recognized' && $record->status === 'Pending Review') {
                $service->decide($operator, $record, 'Recognized', 'Verified for the operational demonstration dataset.');
                $record->refresh();
            }

            $recognizedAt = $status === 'Recognized' ? $achievementAt->copy()->addDay()->setTime(10, 30) : null;
            $record->forceFill([
                'achievement_date' => $achievementAt->toDateString(),
                'submitted_at' => $achievementAt->copy()->addHours(2),
                'reviewed_at' => $recognizedAt,
                'recognized_at' => $recognizedAt,
                'status' => $status,
                'created_at' => $achievementAt->copy()->subDay()->setTime(14, 0),
                'updated_at' => $recognizedAt ?? $achievementAt->copy()->addHours(2),
            ])->save();
        }
    }
}
