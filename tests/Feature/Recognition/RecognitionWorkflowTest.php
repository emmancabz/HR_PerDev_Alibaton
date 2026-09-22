<?php

namespace Tests\Feature\Recognition;

use App\Enums\UserRole;
use App\Models\Recognition\RecognitionCategory;
use App\Models\Recognition\RecognitionRecord;
use App\Models\User;
use App\Services\Recognition\RecognitionService;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class RecognitionWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $hr;
    private User $employee;
    private User $colleague;
    private RecognitionCategory $category;
    private RecognitionService $recognition;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->person('admin-recognition', UserRole::Admin, 'System Administrator', 'Administration');
        $this->hr = $this->person('hr-recognition', UserRole::HR, 'HR Business Partner', 'Human Resources');
        $this->employee = $this->person('employee-recognition', UserRole::User, 'Operations Staff', 'Operations');
        $this->colleague = $this->person('colleague-recognition', UserRole::User, 'Safety Officer', 'Safety & Compliance');
        $this->category = RecognitionCategory::query()->where('code', 'PERFORMANCE_EXCELLENCE')->firstOrFail();
        $this->recognition = app(RecognitionService::class);
    }

    public function test_admin_hr_and_user_may_nominate_an_active_colleague(): void
    {
        $userRecord = $this->recognition->create($this->employee, $this->payload($this->colleague, 'User nomination'));
        $hrRecord = $this->recognition->create($this->hr, $this->payload($this->employee, 'HR nomination'));
        $adminRecord = $this->recognition->create($this->admin, $this->payload($this->colleague, 'Admin nomination', now()->subDays(40)->toDateString()));

        $this->assertSame('Pending Review', $userRecord->status);
        $this->assertSame('Pending Review', $hrRecord->status);
        $this->assertSame('Pending Review', $adminRecord->status);
        $this->assertDatabaseCount('recognition_records', 3);
    }

    public function test_self_recognition_is_rejected(): void
    {
        $this->expectException(ValidationException::class);
        $this->recognition->create($this->employee, $this->payload($this->employee, 'Self nomination'));
    }

    public function test_only_admin_and_hr_can_finalize_recognition(): void
    {
        $record = $this->recognition->create($this->employee, $this->payload($this->colleague, 'Unauthorized decision'));
        $this->expectException(AuthorizationException::class);
        $this->recognition->decide($this->employee, $record, 'Recognized', 'Attempted employee approval.');
    }

    public function test_admin_and_hr_can_independently_finalize(): void
    {
        $first = $this->recognition->create($this->employee, $this->payload($this->colleague, 'Admin approved'));
        $this->recognition->decide($this->admin, $first, 'Recognized', 'Verified achievement.');
        $second = $this->recognition->create($this->hr, $this->payload($this->employee, 'HR approved'));
        $this->recognition->decide($this->hr, $second, 'Recognized', 'Verified achievement.');

        $this->assertDatabaseHas('recognition_records', ['id' => $first->id, 'status' => 'Recognized', 'reviewed_by' => $this->admin->id]);
        $this->assertDatabaseHas('recognition_records', ['id' => $second->id, 'status' => 'Recognized', 'reviewed_by' => $this->hr->id]);
    }

    public function test_published_recognition_is_immutable_and_revocation_requires_a_reason(): void
    {
        $record = $this->recognition->create($this->employee, $this->payload($this->colleague, 'Immutable recognition'));
        $this->recognition->decide($this->admin, $record, 'Recognized', 'Verified achievement.');
        try {
            $this->recognition->updateDraft($this->employee, $record->fresh(), $this->payload($this->colleague, 'Changed title'));
            $this->fail('Published recognition must be immutable.');
        } catch (ValidationException) {
            $this->expectException(ValidationException::class);
            $this->recognition->revoke($this->hr, $record->fresh(), '');
        }
    }

    public function test_user_visibility_excludes_private_decision_reasons_and_audit_history(): void
    {
        $record = $this->recognition->create($this->employee, $this->payload($this->colleague, 'Declined nomination'));
        $this->recognition->decide($this->hr, $record, 'Declined', 'Private review evidence was insufficient.');
        $userState = $this->recognition->state($this->employee);
        $adminState = $this->recognition->state($this->admin);

        $this->assertNull(collect($userState['records'])->firstWhere('id', $record->id)['declineReason']);
        $this->assertSame([], $userState['audit']);
        $this->assertSame('Private review evidence was insufficient.', collect($adminState['records'])->firstWhere('id', $record->id)['declineReason']);
        $this->assertNotEmpty($adminState['audit']);
    }

    public function test_recognition_does_not_issue_certificates_or_change_other_module_outcomes(): void
    {
        $record = $this->recognition->create($this->admin, $this->payload($this->employee, 'Boundary test'));
        $this->recognition->decide($this->hr, $record, 'Recognized', 'Verified achievement.');

        $this->assertSame('user', $this->employee->fresh()->role->value);
        $this->assertDatabaseMissing('recognition_audit_events', ['event_type' => 'CertificateIssued']);
        $this->assertFalse($record->fresh()->source_metadata['automaticImpact']);
        $this->assertNull($record->fresh()->source_metadata['certificateOwner']);
    }


    public function test_duplicate_nomination_is_blocked_within_governed_window(): void
    {
        $this->recognition->create($this->admin, $this->payload($this->employee, 'Documented teamwork contribution'));

        $this->expectException(ValidationException::class);
        $this->recognition->create($this->hr, $this->payload($this->employee, 'Documented teamwork contribution'));
    }

    public function test_category_with_pending_nomination_cannot_be_deactivated(): void
    {
        $this->recognition->create($this->employee, $this->payload($this->colleague, 'Pending category governance'));

        $this->expectException(ValidationException::class);
        $this->recognition->saveCategory($this->admin, [
            'code' => $this->category->code,
            'name' => $this->category->name,
            'description' => $this->category->description,
            'color' => $this->category->color,
            'icon' => $this->category->icon,
            'isActive' => false,
            'displayOrder' => $this->category->display_order,
        ], $this->category);
    }

    public function test_revoked_recognition_can_be_replaced_without_overwriting_history(): void
    {
        $record = $this->recognition->create($this->admin, $this->payload($this->employee, 'Original governed recognition'));
        $this->recognition->decide($this->hr, $record, 'Recognized', 'Verified achievement.');
        $this->recognition->revoke($this->admin, $record->fresh(), 'Evidence correction required.');

        $payload = $this->payload($this->employee, 'Corrected governed recognition', now()->subDays(40)->toDateString());
        $payload['replacesId'] = $record->id;
        $replacement = $this->recognition->create($this->hr, $payload);

        $this->assertSame('Revoked', $record->fresh()->status);
        $this->assertSame($record->id, $replacement->replaces_id);
        $this->assertSame('Pending Review', $replacement->status);
    }

    private function payload(User $recipient, string $title, ?string $date = null): array
    {
        return [
            'recipientId' => $recipient->id, 'categoryId' => $this->category->id,
            'title' => $title, 'achievementDetails' => 'Specific contribution supported by a professional verification note.',
            'achievementDate' => $date ?? now()->toDateString(), 'saveAsDraft' => false,
            'evidence' => [['type' => 'Supporting Note', 'description' => 'Verified during the governed Recognition review.']],
        ];
    }

    private function person(string $key, UserRole $role, string $position, string $department): User
    {
        return User::factory()->create(['personnel_key' => $key, 'core_person_id' => 'CORE-'.strtoupper($key), 'employee_or_trainee_id' => 'PID-'.strtoupper($key), 'role' => $role, 'position' => $position, 'department' => $department, 'person_type' => 'Employee', 'employment_status' => 'Employee']);
    }
}
